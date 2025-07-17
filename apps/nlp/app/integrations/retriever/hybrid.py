import asyncio
import numpy as np
from typing import List, Dict, Any, Optional
from uuid import UUID
from dataclasses import dataclass

from neo4j_graphrag.llm import OpenAILLM
from neo4j_graphrag.embeddings.openai import OpenAIEmbeddings as GraphRAGEmbeddings
from neo4j_graphrag.retrievers import VectorRetriever
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document
from neo4j import GraphDatabase
from pinecone import Pinecone
from app.core import AppConfig
from app.utils.index_utils import generate_org_name


@dataclass
class RetrievalResult:
    """Unified result format for all retrievers"""
    documents: List[Document]
    scores: List[float]
    source: str  # "pinecone", "neo4j", "hybrid"
    metadata: Dict[str, Any]

class IntegratedRetrieverSystem:
    """
    Tích hợp 3 loại retrievers:
    1. Pinecone Vector Store (semantic search)
    2. Neo4j Graph Retriever (relationship-based)
    3. Hybrid Retriever (kết hợp cả hai)
    """
    
    def __init__(self, config: AppConfig, organization_id: UUID):
        self.config = config
        self.organization_id = organization_id
        self.org_namespace = generate_org_name(organization_id, prefix=config.INDEX_NAME)
        
        # Initialize Pinecone
        pc = Pinecone(api_key=config.PINECONE_API_KEY)
        self.pinecone_index = pc.Index(config.INDEX_NAME)
        
        # Initialize Neo4j
        self.neo4j_driver = GraphDatabase.driver(
            config.NEO4J_URI,
            auth=(config.NEO4J_USERNAME, config.NEO4J_PASSWORD)
        )
        
        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=config.OPENAI_API_KEY
        )
        
        # Initialize Pinecone vector store
        self.pinecone_retriever = PineconeVectorStore(
            index=self.pinecone_index,
            embedding=self.embeddings,
            namespace=self.org_namespace
        )
        
        # Initialize Neo4j GraphRAG embeddings
        self.graph_embeddings = GraphRAGEmbeddings(
            model="text-embedding-3-small",
            api_key=config.OPENAI_API_KEY
        )
        
        # Initialize Neo4j retriever
        self.neo4j_retriever = VectorRetriever(
            driver=self.neo4j_driver,
            index_name=f"vector_index_{organization_id}",
            embedder=self.graph_embeddings,
            return_properties=["text", "metadata", "organization_id"]
        )
    
    async def pinecone_search(self, query: str, k: int = 5) -> RetrievalResult:
        """Search using Pinecone vector store"""
        try:
            # Semantic search trong Pinecone
            docs_with_scores = await self.pinecone_retriever.asimilarity_search_with_score(
                query=query,
                k=k,
                namespace=self.org_namespace
            )
            
            documents = [doc for doc, score in docs_with_scores]
            scores = [score for doc, score in docs_with_scores]
            
            return RetrievalResult(
                documents=documents,
                scores=scores,
                source="pinecone",
                metadata={"namespace": self.org_namespace, "search_type": "semantic"}
            )
            
        except Exception as e:
            logger.error(f"Pinecone search error: {e}")
            return RetrievalResult([], [], "pinecone", {"error": str(e)})
    
    async def neo4j_search(self, query: str, k: int = 5) -> RetrievalResult:
        """Search using Neo4j knowledge graph"""
        try:
            # Tìm kiếm trong Neo4j knowledge graph
            query_embedding = await self.graph_embeddings.embed_query(query)
            
            # Custom Cypher query để tìm kiếm có context
            cypher_query = """
            CALL db.index.vector.queryNodes($index_name, $k, $embedding)
            YIELD node, score
            WHERE node.organization_id = $org_id
            
            // Tìm entities liên quan
            OPTIONAL MATCH (node)-[:MENTIONS]->(entity:Entity)
            WHERE entity.organization_id = $org_id
            
            // Tìm documents liên quan thông qua entities
            OPTIONAL MATCH (entity)<-[:MENTIONS]-(related_chunk:Chunk)
            WHERE related_chunk.organization_id = $org_id AND related_chunk <> node
            
            // Tìm relationships của entities
            OPTIONAL MATCH (entity)-[rel]-(connected_entity:Entity)
            WHERE connected_entity.organization_id = $org_id
            
            RETURN 
                node.text as text,
                node.metadata as metadata,
                score,
                collect(DISTINCT entity.name) as entities,
                collect(DISTINCT related_chunk.text)[0..3] as related_contexts,
                collect(DISTINCT {
                    entity: connected_entity.name,
                    relationship: type(rel),
                    description: rel.description
                })[0..5] as relationships
            ORDER BY score DESC
            LIMIT $k
            """
            
            with self.neo4j_driver.session() as session:
                result = session.run(
                    cypher_query,
                    index_name=f"vector_index_{self.organization_id}",
                    k=k,
                    embedding=query_embedding,
                    org_id=str(self.organization_id)
                )
                
                documents = []
                scores = []
                
                for record in result:
                    # Tạo enriched content với graph context
                    base_text = record["text"]
                    entities = record["entities"]
                    relationships = record["relationships"]
                    related_contexts = record["related_contexts"]
                    
                    # Enhance content với graph information
                    enhanced_content = base_text
                    
                    if entities:
                        enhanced_content += f"\n\n**Entities mentioned:** {', '.join(entities)}"
                    
                    if relationships:
                        rel_text = []
                        for rel in relationships:
                            if rel["entity"] and rel["relationship"]:
                                rel_text.append(f"{rel['entity']} ({rel['relationship']})")
                        if rel_text:
                            enhanced_content += f"\n**Related entities:** {', '.join(rel_text)}"
                    
                    if related_contexts:
                        enhanced_content += f"\n\n**Related context:** {' | '.join(related_contexts)}"
                    
                    doc = Document(
                        page_content=enhanced_content,
                        metadata={
                            **record["metadata"],
                            "entities": entities,
                            "relationships": relationships,
                            "source": "neo4j_graph"
                        }
                    )
                    
                    documents.append(doc)
                    scores.append(record["score"])
                
                return RetrievalResult(
                    documents=documents,
                    scores=scores,
                    source="neo4j",
                    metadata={"search_type": "graph_enhanced", "query": query}
                )
                
        except Exception as e:
            logger.error(f"Neo4j search error: {e}")
            return RetrievalResult([], [], "neo4j", {"error": str(e)})
    
    async def hybrid_search(self, query: str, k: int = 10) -> RetrievalResult:
        """
        Hybrid search combining Pinecone and Neo4j
        Returns top results from both sources with score normalization
        """
        try:
            # Parallel search trong cả hai systems
            pinecone_task = self.pinecone_search(query, k=k//2 + 2)
            neo4j_task = self.neo4j_search(query, k=k//2 + 2)
            
            pinecone_result, neo4j_result = await asyncio.gather(
                pinecone_task, neo4j_task
            )
            
            # Normalize scores (0-1 range)
            def normalize_scores(scores):
                if not scores:
                    return []
                max_score = max(scores)
                min_score = min(scores)
                if max_score == min_score:
                    return [1.0] * len(scores)
                return [(score - min_score) / (max_score - min_score) for score in scores]
            
            # Combine results
            combined_docs = []
            combined_scores = []
            
            # Add Pinecone results with boost for semantic similarity
            pinecone_normalized = normalize_scores(pinecone_result.scores)
            for doc, score in zip(pinecone_result.documents, pinecone_normalized):
                doc.metadata["retrieval_source"] = "pinecone"
                combined_docs.append(doc)
                combined_scores.append(score * 0.7)  # Boost semantic results
            
            # Add Neo4j results with boost for relationship context
            neo4j_normalized = normalize_scores(neo4j_result.scores)
            for doc, score in zip(neo4j_result.documents, neo4j_normalized):
                doc.metadata["retrieval_source"] = "neo4j"
                combined_docs.append(doc)
                combined_scores.append(score * 0.8)  # Boost graph results
            
            # Sort by combined score and take top k
            combined_results = list(zip(combined_docs, combined_scores))
            combined_results.sort(key=lambda x: x[1], reverse=True)
            
            final_docs = [doc for doc, score in combined_results[:k]]
            final_scores = [score for doc, score in combined_results[:k]]
            
            return RetrievalResult(
                documents=final_docs,
                scores=final_scores,
                source="hybrid",
                metadata={
                    "pinecone_results": len(pinecone_result.documents),
                    "neo4j_results": len(neo4j_result.documents),
                    "total_combined": len(final_docs)
                }
            )
            
        except Exception as e:
            logger.error(f"Hybrid search error: {e}")
            return RetrievalResult([], [], "hybrid", {"error": str(e)})
    
    async def intelligent_search(self, query: str, k: int = 5) -> RetrievalResult:
        """
        Intelligent search that chooses best retrieval strategy based on query type
        """
        # Analyze query to determine best strategy
        query_lower = query.lower()
        
        # Keywords suggesting relationship queries
        relationship_keywords = ["relationship", "connected", "related", "between", "and", "with"]
        entity_keywords = ["who", "what", "where", "person", "organization", "company"]
        
        # Count keyword matches
        relationship_score = sum(1 for keyword in relationship_keywords if keyword in query_lower)
        entity_score = sum(1 for keyword in entity_keywords if keyword in query_lower)
        
        # Decision logic
        if relationship_score > 0 or entity_score > 1:
            # Graph search for relationship/entity queries
            logger.info(f"Using Neo4j search for relationship query: {query}")
            return await self.neo4j_search(query, k)
        elif len(query.split()) > 10:
            # Hybrid search for complex queries
            logger.info(f"Using hybrid search for complex query: {query}")
            return await self.hybrid_search(query, k)
        else:
            # Pinecone for simple semantic queries
            logger.info(f"Using Pinecone search for semantic query: {query}")
            return await self.pinecone_search(query, k)
    
    def close(self):
        """Close connections"""
        self.neo4j_driver.close()

# Usage example
async def enhanced_rag_query(
    integrated_retriever: IntegratedRetrieverSystem,
    query: str,
    retrieval_strategy: str = "intelligent"  # "pinecone", "neo4j", "hybrid", "intelligent"
) -> Dict[str, Any]:
    """
    Enhanced RAG query with multiple retrieval strategies
    """
    
    # Choose retrieval strategy
    if retrieval_strategy == "pinecone":
        result = await integrated_retriever.pinecone_search(query)
    elif retrieval_strategy == "neo4j":
        result = await integrated_retriever.neo4j_search(query)
    elif retrieval_strategy == "hybrid":
        result = await integrated_retriever.hybrid_search(query)
    elif retrieval_strategy == "intelligent":
        result = await integrated_retriever.intelligent_search(query)
    else:
        raise ValueError(f"Invalid retrieval strategy: {retrieval_strategy}")
    
    if not result.documents:
        return {
            "answer": "No relevant information found.",
            "source": result.source,
            "context": [],
            "metadata": result.metadata
        }
    
    # Generate answer using retrieved context
    context_text = "\n\n".join([doc.page_content for doc in result.documents])
    
    # Here you would use your LLM to generate answer
    # For example with OpenAI:
    # answer = await generate_answer_with_context(query, context_text)
    
    return {
        "answer": f"Based on the retrieved context from {result.source}...",
        "source": result.source,
        "context": result.documents,
        "scores": result.scores,
        "metadata": result.metadata
    }

# Integration with existing create_index function
async def create_integrated_index(
    config: AppConfig,
    documents: List[CoolDocument],
    organization_id: UUID,
):
    """
    Create both Pinecone and Neo4j indexes, return integrated retriever
    """
    
    # Create indexes using existing function
    index_result = await create_enhanced_graphrag_index(config, documents, organization_id)
    
    if not index_result:
        return None
    
    # Create integrated retriever system
    integrated_retriever = IntegratedRetrieverSystem(config, organization_id)
    
    return {
        **index_result,
        "integrated_retriever": integrated_retriever
    }