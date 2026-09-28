async function getSupabaseClient() {
    return window.supabaseClient;
}

async function fetchCommentsForPost(client, postId) {
    const { data: comments, error } = await client
        .from("comments")
        .select("id, post_id, user_id, comment_text, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Comments error:", error);
        return { comments: null, error };
    }
    return { comments: comments || [], error: null };
}

async function fetchUserMap(client, userIds) {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    const { data: users, error } = await client
        .from("users")
        .select("id, username")
        .in("id", uniqueIds);

    if (error) {
        console.error("Users error:", error);
        return {};
    }

    const map = {};
    (users || []).forEach((user) => {
        map[user.id] = user.username;
    });
    return map;
}

async function loadCommentsForPost(postId, container) {
    if (!container) return;

    const client = await getSupabaseClient();
    if (!client) {
        container.innerHTML = "<p>Supabase connection is not available.</p>";
        return;
    }

    const { comments, error } = await fetchCommentsForPost(client, postId);
    if (error) {
        container.innerHTML = "<p>Unable to load comments.</p>";
        return;
    }

    if (!comments || comments.length === 0) {
        container.innerHTML = "<p>No comments yet.</p>";
        return;
    }

    const userMap = await fetchUserMap(client, comments.map((c) => c.user_id));

    container.innerHTML = "";

    comments.forEach((comment) => {
        const username = userMap[comment.user_id] || "Unknown User";

        const commentElement = document.createElement("div");
        commentElement.className = "comment";

        const userElement = document.createElement("strong");
        userElement.textContent = username;

        const textElement = document.createElement("p");
        textElement.textContent = comment.comment_text || "";

        const dateElement = document.createElement("small");
        dateElement.textContent = comment.created_at || "";

        commentElement.append(userElement, textElement, dateElement);
        container.appendChild(commentElement);
    });
}

function attachCommentFormHandlers() {
    const forms = document.querySelectorAll(".comment-form");
    forms.forEach((form) => {
        if (form.dataset.bound === "true") return;
        form.dataset.bound = "true";

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const postId = form.dataset.postId;
            const input = form.querySelector(".comment-input");
            const commentText = (input?.value || "").trim();

            if (!postId || !commentText) return;

            const client = await getSupabaseClient();
            if (!client) {
                alert("Supabase connection is not available.");
                return;
            }

            const currentUser = await window.authAPI?.getCurrentUser();
            if (!currentUser?.id) {
                alert("Please log in to comment.");
                return;
            }

            const { error: insertError } = await client
                .from("comments")
                .insert({
                    post_id: postId,
                    user_id: currentUser.id,
                    comment_text: commentText
                });

            if (insertError) {
                console.error("Comment insert error:", insertError);
                alert(insertError.message);
                return;
            }

            if (input) input.value = "";

            const container = form.parentElement.querySelector(".comments-container");
            if (container) {
                await loadCommentsForPost(postId, container);
            }
        });
    });
}

// Kept for backward compatibility; comments now render per-post under each post.
async function loadComments() {
    // No-op: the global Comments section was removed.
}

async function loadCommentPosts() {
    // No-op: the post picker is no longer used.
}

window.loadComments = loadComments;
window.loadCommentPosts = loadCommentPosts;
window.loadCommentsForPost = loadCommentsForPost;
window.attachCommentFormHandlers = attachCommentFormHandlers;