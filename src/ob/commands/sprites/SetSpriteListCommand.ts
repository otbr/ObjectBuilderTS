import { WorkerCommand } from "../../../workers/WorkerCommand";
import { SpriteData } from "../../../otlib/sprites/SpriteData";

export class SetSpriteListCommand extends WorkerCommand {
    public selectedIds: number[];
    public sprites: SpriteData[];
    public totalCount?: number;
    public minId?: number;
    public maxId?: number;
    public currentMin?: number;
    public currentMax?: number;

    constructor(selectedIds: number[], sprites: SpriteData[], totalCount?: number, minId?: number, maxId?: number, currentMin?: number, currentMax?: number) {
        super();
        this.selectedIds = selectedIds;
        this.sprites = sprites;
        this.totalCount = totalCount;
        this.minId = minId;
        this.maxId = maxId;
        this.currentMin = currentMin;
        this.currentMax = currentMax;
    }
}

