# This is an automatically generated file, please do not change
# gen by protobuf_to_pydantic[v0.3.3.1](https://github.com/so1n/protobuf_to_pydantic)
# Protobuf Version: 6.31.1
# Pydantic Version: 2.10.4
from google.protobuf.message import Message  # type: ignore
from pydantic import BaseModel
from pydantic import Field
import typing


class GetUsersRequest(BaseModel):
    user_ids: typing.List[str] = Field(default_factory=list)


class UserName(BaseModel):
    name: typing.Optional[str] = Field(default="")  # null nếu không set
 

class GetUsersResponse(BaseModel):
    user_map: "typing.Dict[str, UserName]" = Field(
        default_factory=dict
    )  # For quick lookup by ID
