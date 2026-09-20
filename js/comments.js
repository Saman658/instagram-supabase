async function loadComments() {
    const commentsContainer = document.getElementById("comments-container");

    if (!commentsContainer) {
        return;
    }

    if (!window.supabaseClient) {
        console.error("Supabase client not found.");
        commentsContainer.innerHTML =
            "<p>Supabase connection is not available.</p>";
        return;
    }

    const { data: comments, error: commentsError } =
        await window.supabaseClient
            .from("comments")
            .select("id, post_id, user_id, comment_text, created_at")
            .order("created_at", { ascending: false });

    if (commentsError) {
        console.error("Comments error:", commentsError);
        commentsContainer.innerHTML =
            "<p>Unable to load comments.</p>";
        return;
    }

    if (!comments || comments.length === 0) {
        commentsContainer.innerHTML =
            "<p>No comments yet.</p>";
        return;
    }

    const { data: posts, error: postsError } =
        await window.supabaseClient
            .from("posts")
            .select("id, caption");

    if (postsError) {
        console.error("Posts error:", postsError);
        commentsContainer.innerHTML =
            "<p>Unable to load posts.</p>";
        return;
    }

    const { data: users, error: usersError } =
        await window.supabaseClient
            .from("users")
            .select("id, username");

    if (usersError) {
        console.error("Users error:", usersError);
        commentsContainer.innerHTML =
            "<p>Unable to load comment users.</p>";
        return;
    }

    const postMap = {};
    posts.forEach((post) => {
        postMap[post.id] = post.caption || "Untitled post";
    });

    const userMap = {};
    users.forEach((user) => {
        userMap[user.id] = user.username;
    });

    commentsContainer.innerHTML = "";

    comments.forEach((comment) => {
        const username = userMap[comment.user_id] || "Unknown User";
        const postCaption = postMap[comment.post_id] || "Unknown Post";

        const commentElement = document.createElement("div");
        commentElement.classList.add("comment");

        const postElement = document.createElement("strong");
        postElement.textContent = postCaption;

        const userElement = document.createElement("strong");
        userElement.textContent = username;

        const textElement = document.createElement("p");
        textElement.textContent = comment.comment_text || "";

        const dateElement = document.createElement("small");
        dateElement.textContent = comment.created_at || "";

        commentElement.appendChild(postElement);
        commentElement.appendChild(document.createElement("br"));
        commentElement.appendChild(userElement);
        commentElement.appendChild(textElement);
        commentElement.appendChild(dateElement);

        commentsContainer.appendChild(commentElement);
    });
}


loadComments();
async function loadCommentPosts() {
    const postSelect = document.getElementById("comment-post");

    if (!postSelect) {
        return;
    }

    const { data: posts, error } = await window.supabaseClient
        .from("posts")
        .select("id, caption, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Comment posts error:", error);
        return;
    }

    posts.forEach((post) => {
        const option = document.createElement("option");

        option.value = post.id;
        option.textContent = post.caption || "Untitled post";

        postSelect.appendChild(option);
    });
}

loadCommentPosts();
const commentForm = document.getElementById("comment-form");

if (commentForm) {
    commentForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const postSelect = document.getElementById("comment-post");
        const commentInput = document.getElementById("comment-content");

        const postId = postSelect.value;
        const commentText = commentInput.value.trim();

        if (!postId || !commentText) {
            return;
        }

        // Get current user
        const { data: user, error: userError } =
            await window.supabaseClient
                .from("users")
                .select("id")
                .eq("username", "sehrish")
                .single();

        if (userError || !user) {
            console.error("Comment user error:", userError);
            alert("Could not find user.");
            return;
        }

        // Insert comment
        const { error: insertError } =
            await window.supabaseClient
                .from("comments")
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    comment_text: commentText
                });

        if (insertError) {
            console.error("Comment insert error:", insertError);
            alert(insertError.message);
            return;
        }

        // Clear input
        commentInput.value = "";

        // Reload comments
        await loadComments();
    });
}