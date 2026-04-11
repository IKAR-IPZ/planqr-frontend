const API_URL = "/api/messages";

export interface MessageRecord {
    id: number;
    body: string;
    lecturer: string;
    login: string;
    room: string;
    lessonId: number;
    group: string;
    createdAt: string;
    updatedAt?: string;
    isRoomChange?: boolean;
    newRoom?: string | null;
}

export interface MessagePayload {
    body: string;
    lecturer: string;
    login: string;
    room: string;
    lessonId: string | number;
    group: string;
    createdAt: Date | string;
    isRoomChange?: boolean;
    newRoom?: string;
}

export interface UpdateMessagePayload {
    body?: string;
    newRoom?: string;
}

export const fetchMessages = async (lessonId: string | number): Promise<MessageRecord[]> => {
    try {
        const response = await fetch(`${API_URL}/${lessonId}`, {
            cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to fetch messages");
        return await response.json();
    } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
};

export const createMessage = async (message: MessagePayload): Promise<MessageRecord> => {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
            credentials: 'include',
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send message: ${response.status} ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error sending message:", error);
        throw error;
    }
};

export const updateMessage = async (
    id: string | number,
    payload: UpdateMessagePayload,
): Promise<MessageRecord> => {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update message: ${response.status} ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating message:", error);
        throw error;
    }
};

export const deleteMessage = async (id: string | number) => {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to delete message');
    } catch (error) {
        console.error("Error deleting message:", error);
        throw error;
    }
};
