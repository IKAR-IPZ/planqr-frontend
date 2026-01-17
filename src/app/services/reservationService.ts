const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5000';

export interface RoomReservation {
  id?: number;
  room: string;
  department: string;
  startTime: string;
  endTime: string;
  reservedBy?: string;
  status: 'reserved' | 'occupied' | 'free';
}

export const checkRoomStatus = async (room: string, department: string, dateTime: Date): Promise<'occupied' | 'free' | 'reserved'> => {
  try {
    // Check if there's a scheduled event at this time
    const dateStr = dateTime.toISOString().split('T')[0];
    const nextDay = new Date(dateTime);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];
    
    const response = await fetch(`/schedule_student.php?kind=apiwi&department=${department}&room=${room}&start=${dateStr}&end=${nextDayStr}`);
    if (response.ok) {
      const events = await response.json();
      const currentTime = dateTime.getTime();
      
      // Check if there's an event at this time
      const hasEvent = events.some((event: any) => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        return currentTime >= eventStart && currentTime < eventEnd;
      });
      
      if (hasEvent) {
        return 'occupied';
      }
    }
    
    // Check for reservations
    const reservationResponse = await fetch(`${siteUrl}/api/reservations/check?room=${encodeURIComponent(room)}&department=${encodeURIComponent(department)}&datetime=${dateTime.toISOString()}`);
    if (reservationResponse.ok) {
      const reservation = await reservationResponse.json();
      if (reservation.exists) {
        return 'reserved';
      }
    }
    
    return 'free';
  } catch (error) {
    console.error('Error checking room status:', error);
    return 'free';
  }
};

export const createReservation = async (reservation: Omit<RoomReservation, 'id'>): Promise<RoomReservation> => {
  try {
    const response = await fetch(`${siteUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to create reservation');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating reservation:', error);
    throw error;
  }
};

export const getRoomReservations = async (room: string, department: string, startDate: string, endDate: string): Promise<RoomReservation[]> => {
  try {
    const response = await fetch(`${siteUrl}/api/reservations?room=${encodeURIComponent(room)}&department=${encodeURIComponent(department)}&start=${startDate}&end=${endDate}`);
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return [];
  }
};

export const deleteReservation = async (id: number): Promise<void> => {
  try {
    const response = await fetch(`${siteUrl}/api/reservations/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete reservation');
    }
  } catch (error) {
    console.error('Error deleting reservation:', error);
    throw error;
  }
};
