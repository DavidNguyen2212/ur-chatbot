import asyncio
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import RougeScore
from typing import List, Tuple

from gen_test import make_testcases

async def compute_total_and_avg(
    samples: List[SingleTurnSample]
) -> Tuple[float, float]:
    """
    Tính tổng và trung bình BLEU scores cho một list SingleTurnSample.
    
    Args:
        samples: List các SingleTurnSample có thuộc tính response và reference.
    
    Returns:
        Một tuple (total_score, avg_score).
    """
    scorer = RougeScore(rouge_type="rougeL")
    
    # Tạo các task để đánh giá song song
    tasks = [scorer.single_turn_ascore(s) for s in samples]
    scores = await asyncio.gather(*tasks)
    
    total_score = sum(scores)
    avg_score = total_score / len(scores) if scores else 0.0
    
    return total_score, avg_score


# Ví dụ sử dụng
async def main():
    samples = make_testcases("D:/FastAPILLM/tests/llm_test/raft_results.xlsx")
    
    total, avg = await compute_total_and_avg(samples)
    print(f"Tổng ROUGE score: {total:.4f}")
    print(f"Trung bình ROUGE score: {avg:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
