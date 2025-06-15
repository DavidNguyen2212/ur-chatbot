import pandas as pd
# from deepeval.test_case import LLMTestCase

# def make_testcases_de(filename: str = "llmtest.xlsx"):
#     df = pd.read_excel(filename)
#     separator = '-' * 40

#     test_cases = []
#     for _, row in df.iterrows():
#         tc = LLMTestCase(
#             input=row["Input"],
#             expected_output=row["Expected Output"],
#             actual_output=row["Actual output"],
#             retrieval_context=[part.strip() for part in row.get("Context", None).split(separator)] 
#         )
#         test_cases.append(tc)

#     return test_cases

from ragas.dataset_schema import SingleTurnSample
def make_testcases(filename: str = "D:/FastAPILLM/tests/llm_test/dora_results.xlsx"):
    df = pd.read_excel(filename)
    # separator = '\n---\n'

    test_cases = []
    for _, row in df.iterrows():
        tc = SingleTurnSample(
            reference=row["answer"],
            response=row["predicted_answer"],
            # reference=row["context"]
        )
        test_cases.append(tc)

    return test_cases