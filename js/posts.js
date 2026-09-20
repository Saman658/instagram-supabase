
async function loadPosts() {
    const postsContainer = document.getElementById("posts-container");

    if (!window.supabaseClient) {
        console.error("Supabase client not found.");
        postsContainer.innerHTML = "<p>Supabase client not found.</p>";
        return;
    }

    const { data: posts, error: postsError } = await window.supabaseClient
        .from("posts")
        .select("id, user_id, caption, image_url, created_at")
        .order("created_at", { ascending: false });

    if (postsError) {
        console.error("Posts error:", postsError);
        postsContainer.innerHTML = "<p>Unable to load posts.</p>";
        return;
    }

    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = "<p>No posts found.</p>";
        return;
    }

    const { data: users, error: usersError } = await window.supabaseClient
        .from("users")
        .select("id, username");

    if (usersError) {
        console.error("Users error:", usersError);
        postsContainer.innerHTML = "<p>Unable to load users.</p>";
        return;
    }

    const userMap = {};

    users.forEach((user) => {
        userMap[user.id] = user.username;
    });

    postsContainer.innerHTML = "";

    const postIds = [];

    posts.forEach((post) => {
        const username = userMap[post.user_id] || "Unknown User";
        postIds.push(post.id);

        const postElement = document.createElement("div");
        postElement.classList.add("post");

        postElement.innerHTML = `
    <div class="post-header">
        <strong>${username}</strong>
    </div>

    <div class="post-content">
        <p>${post.caption || ""}</p>

        ${post.image_url
                ? `<img src="${post.image_url}" alt="Post image">`
                : ""
            }

        <small>${post.created_at || ""}</small>
    </div>

    <div class="post-actions">
        <button type="button" class="like-button" data-post-id="${post.id}">
            ❤️ Like
        </button>

        <span class="like-count" data-post-id="${post.id}">
            0 likes
        </span>
    </div>
`;

        postsContainer.appendChild(postElement);
    });

    loadLikeCounts(postIds);
}


async function loadLikeCounts(postIds) {
    if (!window.supabaseClient) return;

    for (const postId of postIds) {
        const { count, error } = await window.supabaseClient
            .from("likes")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId);

        if (error) continue;

        const countElement = document.querySelector(
            `.like-count[data-post-id="${postId}"]`
        );

        if (countElement) {
            countElement.textContent = `${count || 0} likes`;
        }
    }
}


// Create Post
const postForm = document.getElementById("post-form");

if (postForm) {
    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const contentInput = document.getElementById("post-content");
        const caption = contentInput.value.trim();

        if (!caption) {
            return;
        }

        if (!window.supabaseClient) {
            console.error("Supabase client not found.");
            alert("Supabase connection is not available.");
            return;
        }

        // Get the current username from the existing profile section
        const profile = document.getElementById("profile");
        const currentUsername =
            profile?.dataset.currentUsername || "instagram_user";

        let { data: user, error: userError } =
            await window.supabaseClient
                .from("users")
                .select("id")
                .eq("username", currentUsername)
                .single();

        // Temporary fallback for learning project:
        // if instagram_user does not exist, use the existing Sehrish user.
        if (userError || !user) {
            const fallback = await window.supabaseClient
                .from("users")
                .select("id")
                .eq("username", "sehrish")
                .single();

            user = fallback.data;
            userError = fallback.error;
        }

        if (userError || !user) {
            console.error("Current user error:", userError);
            alert("Could not find the current user.");
            return;
        }

        // Insert the new post
        const { error: insertError } = await window.supabaseClient
            .from("posts")
            .insert({
                user_id: user.id,
                caption: caption,
                image_url: null
            });

        if (insertError) {
            console.error("Create post error:", insertError);
            alert(insertError.message);
            return;
        }

        // Clear input
        contentInput.value = "";

        // Reload posts
        await loadPosts();
    });
}


loadPosts();
document.addEventListener("click", async (event) => {
    const button = event.target.closest(".like-button");

    if (!button) {
        return;
    }

    const postId = button.dataset.postId;

    if (!window.supabaseClient) {
        console.error("Supabase client not found.");
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
        console.error("Like user error:", userError);
        alert("Could not find user.");
        return;
    }

    // Check whether this user already liked the post
    const { data: existingLike, error: checkError } =
        await window.supabaseClient
            .from("likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle();

    if (checkError) {
        console.error("Like check error:", checkError);
        return;
    }

    if (existingLike) {
        // Unlike
        const { error: deleteError } =
            await window.supabaseClient
                .from("likes")
                .delete()
                .eq("id", existingLike.id);

        if (deleteError) {
            console.error("Unlike error:", deleteError);
            return;
        }

        button.textContent = "❤️ Like";
    } else {
        // Like
        const { error: insertError } =
            await window.supabaseClient
                .from("likes")
                .insert({
                    post_id: postId,
                    user_id: user.id
                });

        if (insertError) {
            console.error("Like insert error:", insertError);
            alert(insertError.message);
            return;
        }

        button.textContent = "💔 Unlike";
    }

    // Update count
    const { count, error: countError } =
        await window.supabaseClient
            .from("likes")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId);

    if (countError) {
        console.error("Like count error:", countError);
        return;
    }

    const countElement = document.querySelector(
        `.like-count[data-post-id="${postId}"]`
    );

    if (countElement) {
        countElement.textContent = `${count || 0} likes`;
    }
});


