import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, SchemaTypes } from 'mongoose';

export type AgentStatusDocument = HydratedDocument<AgentStatus>;

@Schema({ timestamps: { updatedAt: 'updated_at' } })
export class AgentStatus {
    //  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
    @Prop({ required: true, unique: true })
    agent_id: string; // // Không dùng ref vì là microservice

    @Prop({
        enum: ['ONLINE', 'BUSY', 'OFFLINE'],
        default: 'OFFLINE',
    })
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';

    @Prop({ default: Date.now })
    last_activity: Date;

    @Prop({ default: false })
    is_connected: boolean;
}

export const AgentStatusSchema = SchemaFactory.createForClass(AgentStatus);
