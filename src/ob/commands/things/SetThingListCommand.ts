import { WorkerCommand } from "../../../workers/WorkerCommand";
import { ThingListItem } from "../../../otlib/utils/ThingListItem";

export class SetThingListCommand extends WorkerCommand {
    public selectedIds: number[];
    public things: ThingListItem[];
    public totalCount?: number;
    public minId?: number;
    public maxId?: number;
    public currentMin?: number;
    public currentMax?: number;

    constructor(selectedIds: number[], things: ThingListItem[], totalCount?: number, minId?: number, maxId?: number, currentMin?: number, currentMax?: number) {
        super();
        this.selectedIds = selectedIds;
        this.things = things;
        this.totalCount = totalCount;
        this.minId = minId;
        this.maxId = maxId;
        this.currentMin = currentMin;
        this.currentMax = currentMax;
    }
}

