import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, HydratedDocument, SchemaTypes } from "mongoose";

export type CatDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: { createdAt: 'started_at', updatedAt: 'last_activity' } })
export class Conversation {
    @Prop({ required: true })
    organization_id: string; // Không dùng ref vì là microservice

    @Prop()
    customer_email?: string;

    @Prop()
    customer_name?: string;

    @Prop({ required: true })
    customer_session_id: string;

    // @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null }) 
    @Prop({ required: true })
    agent_id: string; // // Không dùng ref vì là microservice

    @Prop({ default: true })
    is_active: boolean;

    @Prop()
    ended_at?: Date;

    @Prop({
        enum: ['AI', 'HUMAN', 'AI_ONLY'],
        default: 'AI',
    })
    mode: string;

    @Prop()
    ai_session_id?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation)