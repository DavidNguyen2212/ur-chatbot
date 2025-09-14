import re
import asyncio
from enum import Enum
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
from uuid import UUID
import openai
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from app.core import AppConfig, get_logger

logger = get_logger()

class QueryComplexity(Enum):
    """Enum định nghĩa các mức độ phức tạp của query"""
    SIMPLE = "simple"           # Câu hỏi đơn giản, tìm kiếm thông tin trực tiếp
    MODERATE = "moderate"       # Câu hỏi trung bình, cần một chút suy luận
    COMPLEX = "complex"         # Câu hỏi phức tạp, cần multi-hop reasoning
    VERY_COMPLEX = "very_complex"  # Câu hỏi rất phức tạp, cần graph traversal

@dataclass
class QueryAnalysisResult:
    """Kết quả phân tích query"""
    complexity: QueryComplexity
    confidence: float
    reasoning: str
    suggested_retriever: str
    keyword: List[str]
    entity_count: int
    requires_relationship: bool
    requires_aggregation: bool
    requires_temporal: bool

class QueryComplexityAnalyzer:
    """Class chính Phân tích độ phức tạp của câu hỏi"""
    def __init__(self, config: AppConfig):
        self.config = config
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=config.OPENAI_API_KEY,
            temperature=0
        )

        # Patterns for rule-based detection
        self.complex_patterns = {
            'relationship': [
                r'\b(relate|relationship|between|connection|link|associate)\b',
                r'\b(how does .* affect|impact|influence)\b',
                r'\b(cause|effect|result|lead to|because)\b'
            ],
            'multi_hop': [
                r'\b(and then|after that|subsequently|following)\b',
                r'\b(who .* that .* which)\b',
                r'\b(first .* then .* finally)\b'
            ],
            'aggregation': [
                r'\b(how many|how much|total|sum|average|mean|count)\b',
                r'\b(all|every|each|list all|enumerate)\b',
                r'\b(compare|contrast|difference between)\b'
            ],
            'temporal': [
                r'\b(when|timeline|chronolog|before|after|during)\b',
                r'\b(history|evolution|change over time)\b',
                r'\b(first|last|recent|earliest|latest)\b'
            ],
            'factual': [
                r'\b(what is|who is|where is|define|meaning of)\b',
                r'\b(fact|specific|exactly|precisely)\b'
            ]
        }

        self.complex_keywords = {
            'simple': ['what', 'who', 'where', 'when', 'definition', 'meaning'],
            'moderate': ['why', 'how', 'explain', 'describe', 'process'],
            'complex': ['analyze', 'compare', 'relationship', 'impact', 'correlation'],
            'very_complex': ['evaluate', 'synthesize', 'predict', 'design', 'strategy']
        }

    async def analyze_query(self, question: str) -> QueryAnalysisResult:
        # Method 1: rule-based analysis
        rule_based_result = self._rule_based_analysis(question)
        # Method 2: keyword density analysis
        keyword_result = self._keyword_analysis(question)
        # Method 3: LLM-based analysis (high accuracy)
        llm_result = self._llm_analysis(question)

        # Voting
        final_result = self._combine_results(
            rule_based_result,
            keyword_result,
            llm_result,
            question
        )

        return final_result
    
    def _rule_based_analysis(self, question: str) -> Dict[str, Any]:
        question_lower = question.lower()
        results = {
            'requires_relationship': False,
            'requires_aggregation': False,
            'requires_temporal': False,
            'is_multi_hop': False,
            'is_factual': False,
            'pattern_matches': []
        }

        for category, patterns in self.complex_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question_lower):
                    results['pattern_matches'].append(category)
                
                if category == "relationship":
                    results['requires_relationship'] = True
                elif category == "aggregation":
                    results['requires_aggregation'] = True
                elif category == "temporal":
                    results['requires_temporal'] = True
                elif category == "multi_hop":
                    results['is_multi_hop'] = True
                elif category == "factual":
                    results['is_factual'] = True
        
        match_count = len(set(results['pattern_matches']))
        if results['is_multi_hop'] or match_count >= 3:
            complexity = QueryComplexity.VERY_COMPLEX
        elif results['requires_relationship'] or match_count >= 2:
            complexity = QueryComplexity.COMPLEX
        elif match_count == 1:
            complexity = QueryComplexity.MODERATE
        else:
            complexity = QueryComplexity.SIMPLE

        results['complexity'] = complexity
        results['confidence'] = min(0.9, 0.3 + (match_count * 0.2))

        return results
    
    def _keyword_analysis(self, question: str) -> Dict[str, Any]:
        question_lower = question.lower()
        words = question_lower.split()

        # Count question word
        question_words = ['what', 'who', 'where', 'when', 'why', 'how', 'which']
        question_word_count = sum(1 for word in words if word in question_words)

        # Estimate entity count (capitalized words, excluding first word)
        entities = re.findall(r'\b[A-Z][a-z]+\b', question)
        entity_count = len(entities)

        # Check complexity keyword
        complexity_scores = {
            QueryComplexity.SIMPLE: 0,
            QueryComplexity.MODERATE: 0,
            QueryComplexity.COMPLEX: 0,
            QueryComplexity.VERY_COMPLEX: 0
        }

        for level, keywords in self.complex_keywords.items():
            for keyword in keywords:
                if keyword in question_lower:
                    complexity_scores[QueryComplexity[level.upper()]] += 1

        # Determine complexity
        max_score = max(complexity_scores.values())
        if max_score == 0:
            # Default based on question length and entity count
            if len(words) < 10 and entity_count < 2:
                complexity = QueryComplexity.SIMPLE
            elif len(words) < 20 and entity_count < 4:
                complexity = QueryComplexity.MODERATE
            else:
                complexity = QueryComplexity.COMPLEX
        else:
            complexity = max(complexity_scores, key=complexity_scores.get)

        return {
            'complexity': complexity,
            'entity_count': entity_count,
            'question_words': question_word_count,
            'word_count': len(words),
            'confidence': 0.7
        }
    
    async def _llm_analysis(self, question: str) -> Dict[str, Any]:
        """
        Sử dụng LLM để phân tích (accurate nhưng chậm hơn)
        """
        try:
            prompt = ChatPromptTemplate.from_template("""
            Analyze the complexity of this question and return a JSON response:
            
            Question: {question}
            
            Classify the question into one of these categories:
            - simple: Direct fact lookup, single entity, no reasoning required
            - moderate: Requires basic explanation or single-step reasoning
            - complex: Requires understanding relationships or multi-step reasoning
            - very_complex: Requires analyzing multiple relationships, aggregation, or complex reasoning
            
            Return JSON with:
            {{
                "complexity": "simple|moderate|complex|very_complex",
                "requires_relationship": true/false,
                "requires_aggregation": true/false,
                "requires_temporal": true/false,
                "entity_count": number,
                "reasoning": "brief explanation",
                "confidence": 0.0-1.0
            }}
            
            Return ONLY valid JSON, no other text.
            """)
            
            response = await self.llm.ainvoke(
                prompt.format_messages(question=question)
            )
            import json
            result = json.loads(response.content)
            result['complexity'] = QueryComplexity(result['complexity'])

            return result

        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}, falling back to rule-based")
            # Fallback to simple classification
            return {
                'complexity': QueryComplexity.MODERATE,
                'confidence': 0.5,
                'reasoning': 'LLM analysis failed, using fallback'
            }
    
    def _combine_results(
        self, 
        rule_based: Dict,
        keyword: Dict,
        llm: Dict,
        question: str
    ) -> QueryAnalysisResult:
        """
        Kết hợp kết quả từ các methods với weighted voting
        """
        weights = {
            'rule_based': 0.3,
            'keyword': 0.2,
            'llm': 0.5
        }

        # Calculate weighted complexity score
        complexity_scores = {
            QueryComplexity.SIMPLE: 0,
            QueryComplexity.MODERATE: 0,
            QueryComplexity.COMPLEX: 0,
            QueryComplexity.VERY_COMPLEX: 0
        }

        # Add weighted score
        for result, weight in [
            (rule_based, weights['rule_based']),
            (keyword, weights['keyword']),
            (llm, weights['llm'])
        ]:
            if 'complexity' in result:
                complexity_scores[result['complexity']] += weight
        
        # Determine final complexity
        final_complexity = max(complexity_scores, key=complexity_scores.get)

        # Calculate confidence
        confidences = [
            rule_based.get('confidence', 0.5) * weights['rule_based'],
            keyword.get('confidence', 0.5) * weights['keyword'],
            llm.get('confidence', 0.5) * weights['llm']
        ]

        final_confidence = sum(confidences)

        # Extract keywords
        words = question.lower().split()
        keywords = [w for w in words if len(w) > 3 and w not in ['what', 'when', 'where', 'which', 'that', 'this']]

        # Determine suggested retriever
        if final_complexity in [QueryComplexity.COMPLEX, QueryComplexity.VERY_COMPLEX]:
            suggested_retriever = "graphrag"
        elif final_complexity == QueryComplexity.MODERATE and final_confidence > 0.7:
            suggested_retriever = "hybrid"
        else:
            suggested_retriever = "pinecone"

        return QueryAnalysisResult(
            complexity=final_complexity,
            confidence=final_confidence,
            reasoning=llm.get('reasoning', 'Combined analysis from multiple methods'),
            suggested_retriever=suggested_retriever,
            keywords=keywords[:5],  # Top 5 keywords
            entity_count=keyword.get('entity_count', 0),
            requires_relationship=rule_based.get('requires_relationship', False) or llm.get('requires_relationship', False),
            requires_aggregation=rule_based.get('requires_aggregation', False) or llm.get('requires_aggregation', False),
            requires_temporal=rule_based.get('requires_temporal', False) or llm.get('requires_temporal', False)
        )

class SmartQueryRouter:
    """
    Smart router để route queries đến retriever phù hợp
    """
    
    def __init__(
        self,
        config: AppConfig,
        graphrag_chains: Dict,
        pinecone_retriever: Any,
        organization_id: UUID
    ):
        self.config = config
        self.graphrag_chains = graphrag_chains
        self.pinecone_retriever = pinecone_retriever
        self.organization_id = organization_id
        self.analyzer = QueryComplexityAnalyzer(config)

        # Cache để tăng performance
        self.analysis_cache = {}
        # Metrics tracking
        self.metrics = {
            'total_queries': 0,
            'pinecone_queries': 0,
            'graphrag_queries': 0,
            'hybrid_queries': 0,
            'avg_response_time': 0
        }

    async def route_query(self, 
        question: str, 
        force_retriever: Optional[str] = None, 
        return_analysis: bool = False
    ) -> Dict[str, Any]:
        """
        Route query đến retriever phù hợp
        
        Args:
            question: Câu hỏi cần trả lời
            force_retriever: Force sử dụng retriever cụ thể (debug/testing)
            return_analysis: Có trả về kết quả phân tích không
        
        Returns:
            Dict chứa answer và metadata
        """
        import time
        start_time = time.time()

        # Check cache
        if question in self.analysis_cache:
            analysis = self.analysis_cache[question]
            logger.info(f"Using cached analysis for question: {question[:50]}...")
        else:
            # Analyze query complexity
            analysis = await self.analyzer.analyze_query(question)
            self.analysis_cache[question] = analysis
            logger.info(f"Query analysis complete: {analysis.complexity.value} (confidence: {analysis.confidence:.2f})")
        
        # Determine retriever
        if force_retriever:
            selected_retriever = force_retriever
        else:
            selected_retriever = self._select_retriever(analysis)
        
        # Route to appropriate retriever
        logger.info(f"Routing to {selected_retriever} retriever...")
        if selected_retriever == "pinecone":
            result = await self._query_pinecone(question)
            self.metrics['pinecone_queries'] += 1
        elif selected_retriever == "graphrag":
            result = await self._query_graphrag(question, analysis)
            self.metrics['graphrag_queries'] += 1
        else:  # hybrid
            result = await self._query_hybrid(question, analysis)
            self.metrics['hybrid_queries'] += 1
        
        # Add metadata
        elapsed_time = time.time() - start_time
        result['metadata'] = {
            'retriever_used': selected_retriever,
            'complexity': analysis.complexity.value,
            'confidence': analysis.confidence,
            'response_time': elapsed_time,
            'requires_relationship': analysis.requires_relationship,
            'entity_count': analysis.entity_count
        }
        
        if return_analysis:
            result['analysis'] = analysis

        # Update metrics
        self.metrics['total_queries'] += 1
        self.metrics['avg_response_time'] = (
            (self.metrics['avg_response_time'] * (self.metrics['total_queries'] - 1) + elapsed_time) 
            / self.metrics['total_queries']
        )
        
        logger.info(f"Query completed in {elapsed_time:.2f}s using {selected_retriever}")
        return result
    
    def _select_retriever(self, analysis: QueryAnalysisResult) -> str:
        """
        Choose retriever based on analysis
        """
        # Override based on specific requirements
        if analysis.requires_relationship and analysis.entity_count > 2:
            return "graphrag"
        
        if analysis.requires_aggregation or analysis.requires_temporal:
            return "graphrag"
        
        # Use suggested retriever with confidence threshold
        if analysis.confidence > 0.75:
            return analysis.suggested_retriever
        
        # Default fallback logic
        if analysis.complexity == QueryComplexity.SIMPLE:
            return "pinecone"
        elif analysis.complexity == QueryComplexity.MODERATE:
            return "hybrid" if analysis.confidence > 0.6 else "pinecone"
        else:
            return "graphrag"
    
    async def _query_pinecone(self, question: str) -> Dict[str, Any]:
        """
        Query using Pinecone (fast vector search)
        """
        try:
            # Perform vector search
            docs = await self.pinecone_retriever.asearch(
                question,
                k=3,
                namespace=f"{self.config.INDEX_NAME}_{self.organization_id}"
            )
            
            # Format context
            context = "\n\n".join([doc.page_content for doc in docs])
            
            # Generate answer using LLM
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                api_key=self.config.OPENAI_API_KEY
            )
            
            prompt = f"""Based on the following context, answer the question concisely and accurately.
            
            Context:
            {context}
            
            Question: {question}
            
            Answer:"""
            
            response = await llm.ainvoke(prompt)
            
            return {
                'answer': response.content,
                'source_documents': docs,
                'retriever_type': 'pinecone'
            }
            
        except Exception as e:
            logger.error(f"Pinecone query failed: {e}")
            # Fallback to GraphRAG
            return await self._query_graphrag(question, None)

    async def _query_graphrag(self, question: str, analysis: Optional[QueryAnalysisResult]) -> Dict[str, Any]:
        try:
            if analysis and analysis.requires_relationship:
                chain_type = "vector_cypher" # Best for relationships
            elif analysis and analysis.requires_aggregation:
                chain_type = "vector_cypher" # Can handle aggregations
            else:
                chain_type = "hybrid"
            
            graphrag_chain = self.graphrag_chains.get(chain_type, self.graphrag_chains.get("hybrid"))
            # Query GraphRAG
            response = await graphrag_chain.search(query_text=question)

            return {
                'answer': response.answer,
                'source_documents': response.retriever_result.records if hasattr(response, 'retriever_result') else [],
                'retriever_type': f'graphrag_{chain_type}'
            }
            
        except Exception as e:
            logger.error(f"GraphRAG query failed: {e}")
            raise

    async def _query_hybrid(
        self,
        question: str,
        analysis: QueryAnalysisResult
    ) -> Dict[str, Any]:
        """
        Hybrid approach: Combine Pinecone and GraphRAG results
        """
        try:
            pinecone_task = await asyncio.create_task(self._query_pinecone(question))
            graphrag_task = await asyncio.create_task(self._query_graphrag(question, analysis))

            pinecone_result, graphrag_result = await asyncio.gather(
                pinecone_task, 
                graphrag_task,
                return_exceptions=True
            )

            # Handle failures
            if isinstance(pinecone_result, Exception):
                logger.warning(f"Pinecone failed in hybrid: {pinecone_result}")
                return graphrag_result if not isinstance(graphrag_result, Exception) else {
                    'answer': "Unable to retrieve answer due to system error.",
                    'error': True
                }
            
            if isinstance(graphrag_result, Exception):
                logger.warning(f"GraphRAG failed in hybrid: {graphrag_result}")
                return pinecone_result

            # Combine results
            combined_answer = await self._combine_answers(
                pinecone_result['answer'],
                graphrag_result['answer'],
                question,
                analysis
            )

            # Merge source documents
            all_docs = []
            if 'source_documents' in pinecone_result:
                all_docs.extend(pinecone_result['source_documents'])
            if 'source_documents' in graphrag_result:
                all_docs.extend(graphrag_result['source_documents'])
            
            return {
                'answer': combined_answer,
                'source_documents': all_docs,
                'retriever_type': 'hybrid',
                'pinecone_answer': pinecone_result['answer'],
                'graphrag_answer': graphrag_result['answer']
            }
        except Exception as e:
            logger.error(f"Hybrid query failed: {e}")
            raise

    async def _combine_answers(
        self,
        pinecone_answer: str,
        graphrag_answer: str,
        question: str,
        analysis: QueryAnalysisResult
    ) -> str:
        """
        Intelligently combine answers from both retrievers
        """
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=self.config.OPENAI_API_KEY,
            temperature=0
        )
        
        prompt = f"""You have two answers to the same question from different retrieval systems.
        Combine them into a single, comprehensive answer that includes the best information from both.
        
        Question: {question}
        
        Answer 1 (Vector Search - good for semantic similarity):
        {pinecone_answer}
        
        Answer 2 (Graph Search - good for relationships and facts):
        {graphrag_answer}
        
        Question Analysis:
        - Complexity: {analysis.complexity.value}
        - Requires Relationships: {analysis.requires_relationship}
        - Entity Count: {analysis.entity_count}
        
        Provide a unified answer that:
        1. Prioritizes factual accuracy from the graph search
        2. Includes relevant context from vector search
        3. Removes any contradictions by preferring the graph answer for facts
        4. Is concise and well-structured
        
        Combined Answer:"""
        
        response = await llm.ainvoke(prompt)
        return response.content
            
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get routing metrics for monitoring
        """
        return {
            **self.metrics,
            'cache_size': len(self.analysis_cache),
            'retriever_distribution': {
                'pinecone': f"{(self.metrics['pinecone_queries'] / max(1, self.metrics['total_queries']) * 100):.1f}%",
                'graphrag': f"{(self.metrics['graphrag_queries'] / max(1, self.metrics['total_queries']) * 100):.1f}%",
                'hybrid': f"{(self.metrics['hybrid_queries'] / max(1, self.metrics['total_queries']) * 100):.1f}%"
            }
        }
    
# # Integration với code hiện tại của bạn
# async def create_smart_router(
#     config: AppConfig,
#     graphrag_chains: Dict,
#     pinecone_retriever: Any,
#     organization_id: UUID
# ) -> SmartQueryRouter:
#     """
#     Factory function để tạo Smart Router
#     """
#     router = SmartQueryRouter(
#         config=config,
#         graphrag_chains=graphrag_chains,
#         pinecone_retriever=pinecone_retriever,
#         organization_id=organization_id
#     )
    
#     logger.info("Smart Query Router initialized successfully")
#     return router


# # Example usage
# async def main_example():
#     """
#     Example về cách sử dụng Smart Router
#     """
#     # Giả sử bạn đã có các components
#     config = AppConfig()
#     organization_id = UUID("...")
    
#     # Tạo router
#     router = await create_smart_router(
#         config, 
#         graphrag_chains,
#         pinecone_retriever,
#         organization_id
#     )
    
#     # Test với các câu hỏi khác nhau
#     test_questions = [
#         "What is the company's revenue?",  # Simple
#         "How did Q1 performance compare to Q2?",  # Moderate
#         "What is the relationship between marketing spend and customer acquisition?",  # Complex
#         "Analyze the impact of product launches on revenue across all regions and quarters"  # Very Complex
#     ]
    
#     for question in test_questions:
#         result = await router.route_query(
#             question=question,
#             return_analysis=True
#         )
        
#         print(f"\nQuestion: {question}")
#         print(f"Complexity: {result['metadata']['complexity']}")
#         print(f"Retriever: {result['metadata']['retriever_used']}")
#         print(f"Response Time: {result['metadata']['response_time']:.2f}s")
#         print(f"Answer: {result['answer'][:200]}...")
    
#     # Print metrics
#     print("\n=== Router Metrics ===")
#     metrics = router.get_metrics()
#     for key, value in metrics.items():
#         print(f"{key}: {value}")