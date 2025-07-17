import shutil
from typing import List
from uuid import UUID
from neo4j import GraphDatabase
from neo4j_graphrag.llm import OpenAILLM
from neo4j_graphrag.embeddings.openai import OpenAIEmbeddings as GraphRAGEmbeddings
from neo4j_graphrag.experimental.pipeline.kg_builder import SimpleKGPipeline
from neo4j_graphrag.retrievers import VectorRetriever, VectorCypherRetriever, HybridRetriever
from neo4j_graphrag.generation import GraphRAG
from langchain_core.documents import Document
from app.core import AppConfig, get_logger

logger = get_logger()
class EnhancedGraphRAGPipeline:
    """Enhanced GraphRAG pipeline using neo4j-graphrag-python"""
    
    def __init__(self, config: AppConfig):
        self.config = config
        self.driver = GraphDatabase.driver(
            config.NEO4J_URI,
            auth=(config.NEO4J_USERNAME, config.NEO4J_PASSWORD)
        )
        
        # Initialize LLM and embeddings for GraphRAG
        self.llm = OpenAILLM(
            model_name="gpt-4o-mini",
            api_key=config.OPENAI_API_KEY
        )
        
        self.embedder = GraphRAGEmbeddings(
            model="text-embedding-3-small",
            api_key=config.OPENAI_API_KEY
        )
        
        # Knowledge Graph Pipeline - Updated to use SimpleKGPipeline
        self.kg_pipeline = SimpleKGPipeline(
            llm=self.llm,
            driver=self.driver,
            embedder=self.embedder,
            on_error="IGNORE"
        )

    async def create_knowledge_graph(self, documents: List[Document], organization_id: UUID):
        """Create knowledge graph using neo4j-graphrag-python"""
        
        # Clear existing data for organization
        with self.driver.session() as session:
            session.run(
                "MATCH (n) WHERE n.organization_id = $org_id DETACH DELETE n",
                org_id=str(organization_id)
            )
        
        # Process documents through KG pipeline
        for doc_idx, doc in enumerate(documents):
            doc_data = {
                "id": f"doc_{organization_id}_{doc_idx}",
                "text": doc.page_content,
                "metadata": {**doc.metadata, "organization_id": str(organization_id)}
            }
            
            # Process document through KG pipeline
            await self.kg_pipeline.run(doc_data)
            
        logger.info(f"Knowledge graph created for organization {organization_id}")
    
    def create_retrievers(self, organization_id: UUID):
        """Create different types of retrievers"""
        
        # Vector Retriever - tìm kiếm dựa trên vector embeddings
        vector_retriever = VectorRetriever(
            driver=self.driver,
            index_name=f"vector_index_{organization_id}",
            embedder=self.embedder,
            return_properties=["text", "metadata", "organization_id"]
        )
        
        # Vector + Cypher Retriever - kết hợp vector search với Cypher queries
        vector_cypher_retriever = VectorCypherRetriever(
            driver=self.driver,
            index_name=f"vector_index_{organization_id}",
            embedder=self.embedder,
            retrieval_query="""
            MATCH (node)
            WHERE node.organization_id = $organization_id
            CALL db.index.vector.queryNodes($index_name, $k, $embedding)
            YIELD node as similar_node, score
            MATCH (similar_node)-[:RELATES_TO*1..2]-(connected)
            WHERE connected.organization_id = $organization_id
            RETURN similar_node.text as text, 
                   similar_node.metadata as metadata,
                   collect(connected.text) as related_context,
                   score
            ORDER BY score DESC
            """,
            query_parameters={"organization_id": str(organization_id)}
        )
        
        # Hybrid Retriever - kết hợp nhiều phương pháp
        hybrid_retriever = HybridRetriever(
            driver=self.driver,
            vector_index_name=f"vector_index_{organization_id}",
            embedder=self.embedder,
            fulltext_index_name=f"fulltext_index_{organization_id}",
            return_properties=["text", "metadata", "organization_id"]
        )
        
        return {
            "vector": vector_retriever,
            "vector_cypher": vector_cypher_retriever,
            "hybrid": hybrid_retriever
        }
    
    def create_graphrag_chain(self, retriever, organization_id: UUID):
        """Create GraphRAG chain for question answering"""
        
        return GraphRAG(
            retriever=retriever,
            llm=self.llm,
            prompt_template="""
            You are a helpful assistant answering questions based on the provided context.
            
            Context from Knowledge Graph:
            {context}
            
            Question: {question}
            
            Please provide a comprehensive answer based on the context. If you find relationships
            between entities, mention them to provide better understanding.
            
            Answer:
            """
        )
    
    async def setup_indexes(self, organization_id: UUID):
        """Setup necessary indexes for the organization"""
        
        org_id = str(organization_id)
        
        with self.driver.session() as session:
            # Create vector index
            try:
                session.run(f"""
                    CREATE VECTOR INDEX `vector_index_{organization_id}` IF NOT EXISTS
                    FOR (n:Chunk) ON (n.embedding)
                    OPTIONS {{
                        indexConfig: {{
                            `vector.dimensions`: 1536,
                            `vector.similarity_function`: 'cosine'
                        }}
                    }}
                """)
                
                # Create fulltext index
                session.run(f"""
                    CREATE FULLTEXT INDEX `fulltext_index_{organization_id}` IF NOT EXISTS
                    FOR (n:Chunk) ON (n.text)
                """)
                
                logger.info(f"Indexes created for organization {organization_id}")
                
            except Exception as e:
                logger.warning(f"Index creation failed: {e}")


async def create_enhanced_graphrag_index(
    config: AppConfig,
    documents: List[CoolDocument],
    organization_id: UUID,
):
    """Enhanced function using neo4j-graphrag-python"""
    
    try:
        if not documents or len(documents) == 0:
            raise ValueError("No training documents available.")
        
        # 1. Prepare documents (giữ nguyên logic cũ)
        temp_dir = tempfile.mkdtemp()
        files_to_upload, metadata = await prepare_training_files(documents, temp_dir, config, organization_id)
        
        # 2. Create Pinecone index (giữ nguyên)
        shared_index_name = config.INDEX_NAME
        pc = Pinecone(api_key=config.PINECONE_API_KEY)
        existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
        
        if shared_index_name not in existing_indexes:
            pc.create_index(
                name=shared_index_name,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            logger.info(f"Creating shared index: {shared_index_name}")
            while not pc.describe_index(shared_index_name).status["ready"]:
                await asyncio.sleep(1)
        
        # 3. Handle org namespace
        org_namespace = generate_org_name(organization_id, prefix=shared_index_name)
        index = pc.Index(shared_index_name)
        index_stats = index.describe_index_stats()
        existing_namespaces = list(index_stats.get("namespaces", {}).keys())
        if org_namespace in existing_namespaces:
            index.delete(delete_all=True, namespace=org_namespace)
        
        # 4. Load documents
        valid_file_tuples: List[Tuple[str, Tuple[str, BinaryIO, str]]] = [f for f in files_to_upload if f[0] == "files"]
        allDocs: List[Document] = await load_files_by_type(
            files=valid_file_tuples,
            priorities=metadata["files"]
        )
        
        logger.info(f"Total documents loaded: {len(allDocs)}")
        
        # 5. Initialize GraphRAG Pipeline
        graphrag_pipeline = EnhancedGraphRAGPipeline(config)
        
        # 6. Setup Neo4j indexes
        await graphrag_pipeline.setup_indexes(organization_id)
        
        # 7. Create Knowledge Graph using neo4j-graphrag-python
        logger.info("Creating knowledge graph with neo4j-graphrag-python...")
        await graphrag_pipeline.create_knowledge_graph(allDocs, organization_id)
        
        # 8. Create Pinecone vector store (giữ nguyên)
        batch_size, text_splitter = set_batch_and_splitter(len(allDocs))
        embedder = OpenAIEmbeddings(
            model="text-embedding-3-small", 
            api_key=config.OPENAI_API_KEY
        )
        
        logger.info("Processing and indexing documents in Pinecone...")
        vector_store = PineconeVectorStore(index=index, embedding=embedder)
        
        for i in tqdm(range(0, len(allDocs), batch_size), desc="Processing batches"):
            batch = allDocs[i : i + batch_size]
            batch_splits = text_splitter.split_documents(batch)
            await vector_store.aadd_documents(batch_splits, namespace=org_namespace)
        
        # 9. Create retrievers
        retrievers = graphrag_pipeline.create_retrievers(organization_id)
        
        # 10. Create GraphRAG chains
        graphrag_chains = {}
        for retriever_type, retriever in retrievers.items():
            graphrag_chains[retriever_type] = graphrag_pipeline.create_graphrag_chain(
                retriever, organization_id
            )
        
        index_url = pc.describe_index(shared_index_name)["host"]
        logger.info("✅ Enhanced GraphRAG index creation completed.")
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        return {
            "message": "Enhanced GraphRAG index creation completed successfully.",
            "namespace": org_namespace,
            "index_url": index_url,
            "retrievers": retrievers,
            "graphrag_chains": graphrag_chains,
            "pipeline": graphrag_pipeline
        }
        
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")
        return None

# Usage example
async def query_enhanced_graphrag(
    question: str,
    graphrag_chains: dict,
    retriever_type: str = "hybrid"
):
    """Query the enhanced GraphRAG system"""
    
    if retriever_type not in graphrag_chains:
        raise ValueError(f"Invalid retriever type: {retriever_type}")
    
    graphrag_chain = graphrag_chains[retriever_type]
    
    # Get response from GraphRAG
    response = await graphrag_chain.search(query_text=question)
    
    return {
        "answer": response.answer,
        "context": response.retriever_result.records,
        "retriever_type": retriever_type
    }