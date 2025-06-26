import asyncio
from typing import List
import dotenv
from ragas import evaluate
dotenv.load_dotenv()
import pandas as pd
from ragas.dataset_schema import SingleTurnSample, EvaluationDataset
from ragas.metrics._factual_correctness import FactualCorrectness
from ragas.metrics import AnswerAccuracy, SemanticSimilarity, Faithfulness
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI
from langchain_openai import OpenAIEmbeddings

evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o"))
evaluator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings())
def make_testcases(filename: str = "D:/FastAPILLM/tests/llm_test/dora_results.xlsx"):
    df = pd.read_excel(filename)
    # separator = '\n---\n'

    test_cases = []
    for _, row in df.iterrows():
        tc = SingleTurnSample(
            user_input=row["question"],
            response=row["predicted_answer"],
            # retrieved_contexts=row["context"].split("\n---\n")
            reference=row["context"]
        )
        # print(tc)
        test_cases.append(tc)

    return EvaluationDataset(samples=test_cases)

def main():
    dataset = make_testcases("D:/FastAPILLM/tests/llm_test/dora_results.xlsx")
    
    results = evaluate(dataset, metrics=[AnswerAccuracy(llm=evaluator_llm)], batch_size=4)
    results.to_pandas().to_csv("dora_AAA.csv")
    
if __name__ == "__main__":
    main()
