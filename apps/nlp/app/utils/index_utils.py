import hashlib
from uuid import UUID


def generate_org_name(organization_id: UUID, prefix: str) -> str:
    """
    Generate a unique Pinecone index name using SHA-256 hash of the organization_id.

    Args:
        organization_id (str): The organization ID to hash.
        prefix (str): Optional prefix for the index name (default is 'org_index').

    Returns:
        str: A unique index name.
    """
    # Hash the organization_id using SHA-256
    hash_object = hashlib.sha256(str(organization_id).encode())
    hashed_id = (
        hash_object.hexdigest()
    )  # Get the hexadecimal representation of the hash

    # Combine prefix and hashed ID to create the index name
    index_name = f"{prefix}-{hashed_id[:16]}"  # Use the first 16 characters of the hash for brevity
    return index_name