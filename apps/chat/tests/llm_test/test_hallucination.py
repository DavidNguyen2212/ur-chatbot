import dotenv
from gen_test import make_testcases_de
dotenv.load_dotenv()
# import pytest
# from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from deepeval import evaluate
from deepeval.metrics import HallucinationMetric
from deepeval.test_case import LLMTestCase

# Replace this with the actual documents that you are passing as input to your LLM.
context=["""Question: i want assistance to buy an item
    Answer: Glad you contacted and expressing your desire for assistance in purchasing an item. I'm here to provide you with the guidance you need to make a well-informed decision and complete your purchase successfully. Could you please let me know the specific item you are interested in? With that information, I can provide you with further details, assist you in navigating through the purchasing process, and answer any questions you may have.
""", """Question: can you help me purchasing a damn item?
    Answer: We appreciate your inquiry and expressing your interest in purchasing an item with us. I understand that you are looking for assistance in the purchasing process. I'm here to provide you with the guidance and support you need. Let's work together to ensure a smooth and satisfying shopping experience. Please provide some details about the item you would like to purchase, such as the name, quantity, or any specific requirements you may have. With this information, I can assist you further in finding the right item and guiding you through the purchasing process..
""", """Question: wanna correct the acdress can uhelp me
    Answer: I'll do my best! I can assist you in correcting your address. Please provide me with the correct shipping address..
"""]

# Replace this with the actual output from your LLM application
actual_output="""Certainly! I'd be happy to assist you with that. Could you please let me know what item you're interested in purchasing? This will help me guide you through the process."""

test_case = LLMTestCase(
    input="I want help purchasing an item",
    actual_output=actual_output,
    context=context
)
metric = HallucinationMetric(threshold=0.5)

# To run metric as a standalone
# metric.measure(test_case)
# print(metric.score, metric.reason)

evaluate(test_cases=[test_case], metrics=[metric])