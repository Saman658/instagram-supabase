console.log("JavaScript is connected successfully!");

async function testSmartProcessor() {
    const { data: sessionData, error: sessionError } =
        await window.supabaseClient.auth.getSession();

    if (sessionError) {
        console.error("Session Error:", sessionError);
        return;
    }

    if (!sessionData.session) {
        console.error("No logged-in Supabase session found.");
        return;
    }

    const { data, error } =
        await window.supabaseClient.functions.invoke("smart-processor", {
            headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`
            }
        });

    if (error) {
        console.error("Smart Processor Error:", error);
        return;
    }

    console.log("Smart Processor Response:", data);
}

console.log("Smart Processor test code loaded");

testSmartProcessor();