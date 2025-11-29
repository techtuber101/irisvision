export type IMaintenanceNotice =
  | {
      enabled: true;
      startTime: string; // Date
      endTime: string; // Date
    }
  | {
      enabled: false;
      startTime?: undefined;
      endTime?: undefined;
    };

// Disabled - Vercel Edge Config not available
export const maintenanceNoticeFlag = async (): Promise<IMaintenanceNotice> => {
  return { enabled: false } as const;
};