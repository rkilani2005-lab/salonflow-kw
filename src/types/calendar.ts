 // Calendar and booking types for SalonFlow
 
 export type AppointmentStatus = 
   | 'planned' 
   | 'confirmed' 
   | 'checked_in' 
   | 'in_service' 
   | 'completed' 
   | 'cancelled' 
   | 'no_show';
 
 export type ServiceCategory = 
   | 'hair' 
   | 'nails' 
   | 'facial' 
   | 'makeup' 
   | 'waxing' 
   | 'massage' 
   | 'other';
 
 export interface Staff {
   id: string;
   name: string;
   nameAr?: string;
   avatar?: string;
   color: string;
   workingHours: {
     start: string; // "09:00"
     end: string;   // "18:00"
   };
   breaks?: {
     start: string;
     end: string;
   }[];
   skills: string[]; // service IDs
   status: 'available' | 'busy' | 'break' | 'off';
 }
 
 export interface Service {
   id: string;
   name: string;
   nameAr?: string;
   category: ServiceCategory;
   duration: number; // minutes
   price: number; // KWD
   color: string;
   requiresResource?: string; // resource ID
 }
 
 export interface Client {
   id: string;
   name: string;
   mobile: string;
   email?: string;
   tier: 'vip' | 'normal';
 }
 
 export interface Appointment {
   id: string;
   clientId: string;
   clientName: string;
   staffId: string;
   serviceId: string;
   serviceName: string;
   serviceCategory: ServiceCategory;
   date: string; // YYYY-MM-DD
   startTime: string; // "09:00"
   endTime: string; // "10:00"
   duration: number; // minutes
   status: AppointmentStatus;
   notes?: string;
   price: number;
 }
 
 export interface CalendarViewState {
   date: Date;
   view: 'day' | 'week' | 'month';
   visibleStaffIds: string[];
   sidebarCollapsed: boolean;
 }
 
 export interface TimeSlot {
   time: string; // "09:00"
   hour: number;
   minute: number;
 }
 
 export const SERVICE_CATEGORY_COLORS: Record<ServiceCategory, string> = {
   hair: 'hsl(340, 82%, 52%)',
   nails: 'hsl(280, 68%, 60%)',
   facial: 'hsl(200, 98%, 48%)',
   makeup: 'hsl(38, 92%, 50%)',
   waxing: 'hsl(160, 84%, 39%)',
   massage: 'hsl(262, 83%, 58%)',
   other: 'hsl(220, 9%, 46%)',
 };