// Main application initialization
console.log("Instagram Mini App initialized");

let dataLoaded = false;

async function loadAppData() {
    if (dataLoaded) return;
    dataLoaded = true;

    if (window.loadUsers) {
        await window.loadUsers();
    }
    if (window.loadPosts) {
        await window.loadPosts();
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    if (!window.authAPI) return;

    window.authAPI.initAuthStateChange();
    await window.authAPI.updateAuthUI();
    await loadAppData();
});

window.addEventListener("authStateReady", async () => {
    if (await window.authAPI?.isLoggedIn()) {
        dataLoaded = false;
        await loadAppData();
    }
});