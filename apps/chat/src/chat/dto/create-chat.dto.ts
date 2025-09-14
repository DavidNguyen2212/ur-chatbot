import { IsUUID } from "class-validator";
import { UUID } from "crypto";

export class CreateChatDto {}

export class AgentChangeDTO {
    @IsUUID()
    agent_id: UUID
}