export interface WarehouseLayout {
  zones: {
    id: string;
    name: string;
    type: 'ambient' | 'cold' | 'hazmat';
    capacity: number; // total bins
    dispatch_proximity: number; // 1-10, 10 is closest
  }[];
  aisles: {
    id: string;
    zone_id: string;
    coordinate_x: number;
  }[];
  bins: {
    id: string;
    aisle_id: string;
    coordinate_y: number;
    max_weight: number;
  }[];
}

export interface InventoryItem {
  sku: string;
  name: string;
  bin_id: string;
  quantity: number;
  weight_per_unit: number;
  is_hazmat: boolean;
  temperature_req: 'ambient' | 'cold';
  velocity_class?: 'A' | 'B' | 'C';
}

export interface Order {
  id: string;
  priority: 'express' | 'same-day' | 'standard';
  items: {
    sku: string;
    quantity: number;
  }[];
  timestamp: string;
}

export interface WarehouseInput {
  layout: WarehouseLayout;
  inventory: InventoryItem[];
  orders: Order[];
  active_pickers: number;
  throughput_target: number; // orders per hour
}

export interface PickRoute {
  picker_id: string;
  sequence: {
    bin_id: string;
    sku: string;
    quantity: number;
    order_id: string;
  }[];
}

export interface SlotChange {
  sku: string;
  current_bin: string;
  recommended_bin: string;
  justification: string;
}

export interface WarehouseAnalysis {
  pick_routes: PickRoute[];
  slot_changes: SlotChange[];
  capacity_flags: {
    zone_id: string;
    utilization_percent: number;
  }[];
  estimated_completion_minutes: number;
  alerts: string[];
  staffing_recommendation?: string;
}
