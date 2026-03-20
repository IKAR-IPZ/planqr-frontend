const API_URL = "/api/messages";

export const fetchMessages = async (lessonId: string | number) => {
    try {
        const response = await fetch(`${API_URL}/${lessonId}`);
        if (!response.ok) throw new Error("Failed to fetch messages");
        return await response.json();
    } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
};

export const createMessage = async (message: any) => {
    console.log("[messageService] createMessage called with:", JSON.stringify(message));
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
        });
        console.log("[messageService] POST response status:", response.status, response.statusText);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[messageService] POST failed:", response.status, errorText);
            throw new Error(`Failed to send message: ${response.status} ${errorText}`);
        }
        const result = await response.json();
        console.log("[messageService] POST success:", JSON.stringify(result));
        return result;
    } catch (error) {
        console.error("[messageService] Error sending message:", error);
        throw error; // RE-THROW so the caller sees it!
    }
};

export const deleteMessage = async (id: number) => {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete message');
    } catch (error) {
        console.error("Error deleting message:", error);
        throw error;
    }
};
