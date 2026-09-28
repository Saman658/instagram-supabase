async function getSupabaseClient() {
    return window.supabaseClient;
}

async function getMyUserInfo() {
    const [user, session] = await Promise.all([
        window.authAPI?.getCurrentUser(),
        window.authAPI?.getSession()
    ]);

    if (!user || !session?.user?.id) return null;

    return {
        usersId: user.id,
        authId: session.user.id
    };
}

async function loadPosts() {
    const postsContainer = document.getElementById("posts-container");

    const client = await getSupabaseClient();
    if (!client) {
        console.error("Supabase client not found.");
        postsContainer.innerHTML = "<p>Supabase client not found.</p>";
        return;
    }

    const { data: posts, error: postsError } = await client
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

    const { data: users, error: usersError } = await client
        .from("users")
        .select("id, username, profile_image");

    if (usersError) {
        console.error("Users error:", usersError);
        postsContainer.innerHTML = "<p>Unable to load users.</p>";
        return;
    }

    const userMap = {};
    const userProfileImageMap = {};

    users.forEach((user) => {
        userMap[user.id] = user.username;
        userProfileImageMap[user.id] = user.profile_image;
    });

    const myInfo = await getMyUserInfo();
    const currentUserId = myInfo?.usersId;

    const postIds = posts.map(p => p.id);

    const { data: likeCounts, error: likeCountError } = await client
        .from("likes")
        .select("post_id")
        .in("post_id", postIds);

    const likeCountMap = {};
    if (!likeCountError && likeCounts) {
        likeCounts.forEach(like => {
            likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
        });
    }

    const likedPostIds = new Set();
    if (currentUserId && postIds.length > 0) {
        const { data: userLikes } = await client
            .from("likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds);
        if (userLikes) {
            userLikes.forEach(like => likedPostIds.add(like.post_id));
        }
    }

    postsContainer.innerHTML = "";

    posts.forEach((post) => {
        const username = userMap[post.user_id] || "Unknown User";
        const profileImage = userProfileImageMap[post.user_id];
        const likeCount = likeCountMap[post.id] || 0;
        const isLiked = likedPostIds.has(post.id);

        const postElement = document.createElement("article");
        postElement.className = "post";
        postElement.dataset.postId = post.id;

        postElement.innerHTML = `
            <div class="post-header">
                <a href="pages/profile.html?user=${encodeURIComponent(username)}" class="post-author-link">
                    <strong>${username}</strong>
                </a>
            </div>

            <div class="post-content">
                <p>${post.caption || ""}</p>

                <small>${post.created_at || ""}</small>
            </div>

            <div class="post-actions">
                <button type="button" class="like-button ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                    ${isLiked ? "💔 Unlike" : "❤️ Like"}
                </button>

                <span class="like-count" data-post-id="${post.id}">
                    ${likeCount} likes
                </span>
            </div>

            <div class="comments-section" data-post-id="${post.id}">
                <h3 class="comments-heading">Comments</h3>
                <div class="comments-container" data-post-id="${post.id}">
                    <p class="comments-loading-message">Loading comments...</p>
                </div>
                <form class="comment-form" data-post-id="${post.id}">
                    <input type="text" class="comment-input" placeholder="Write a comment..." required>
                    <button type="submit">Comment</button>
                </form>
            </div>
        `;

        const profileImageUrl = String(profileImage || "").trim();
        if (profileImageUrl) {
            const profileImageElement = document.createElement("img");
            profileImageElement.className = "post-author-image";
            profileImageElement.src = profileImageUrl;
            profileImageElement.alt = `${username} profile`;
            postElement.querySelector(".post-author-link").prepend(profileImageElement);
        } else {
            const profileImageFallback = document.createElement("span");
            profileImageFallback.className = "post-author-placeholder";
            profileImageFallback.textContent = username.charAt(0).toUpperCase();
            postElement.querySelector(".post-author-link").prepend(profileImageFallback);
        }

        const postImageUrl = String(post.image_url || "").trim();
        if (postImageUrl) {
            const postImageElement = document.createElement("img");
            postImageElement.src = postImageUrl;
            postImageElement.alt = "Post image";
            postElement.querySelector(".post-content").insertBefore(
                postImageElement,
                postElement.querySelector(".post-content small")
            );
        }

        postsContainer.appendChild(postElement);
    });

    if (window.attachCommentFormHandlers) {
        window.attachCommentFormHandlers();
    }

    if (window.loadCommentsForPost) {
        posts.forEach((post) => {
            const container = postsContainer.querySelector(`.comments-container[data-post-id="${post.id}"]`);
            if (container) {
                window.loadCommentsForPost(post.id, container);
            }
        });
    }

    attachLikeListeners(client);
}

function attachLikeListeners(client) {
    const postsContainer = document.getElementById("posts-container");
    if (!postsContainer) return;

    postsContainer.querySelectorAll(".like-button").forEach(button => {
        button.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const postId = btn.dataset.postId;
            if (!postId) return;

            const myInfo = await getMyUserInfo();
            if (!myInfo?.usersId) {
                alert("Please log in to like posts.");
                return;
            }

            btn.disabled = true;
            const isLiked = btn.classList.contains("liked");
            let error;

            if (isLiked) {
                const result = await client
                    .from("likes")
                    .delete()
                    .eq("post_id", postId)
                    .eq("user_id", myInfo.usersId);
                error = result.error;
            } else {
                const result = await client
                    .from("likes")
                    .insert({
                        post_id: postId,
                        user_id: myInfo.usersId
                    });
                error = result.error;
            }

            if (error) {
                console.error(isLiked ? "Unlike error:" : "Like error:", error);
                alert(error.message);
                btn.disabled = false;
                return;
            }

            btn.classList.toggle("liked");
            btn.textContent = isLiked ? "❤️ Like" : "💔 Unlike";

            const countEl = postsContainer.querySelector(`.like-count[data-post-id="${postId}"]`);
            if (countEl) {
                const currentCount = parseInt(countEl.textContent) || 0;
                countEl.textContent = `${isLiked ? currentCount - 1 : currentCount + 1} likes`;
            }

            btn.disabled = false;
        });
    });
}

const postForm = document.getElementById("post-form");

if (postForm) {
    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const contentInput = document.getElementById("post-content");
        const caption = contentInput.value.trim();

        if (!caption) {
            return;
        }

        const client = await getSupabaseClient();
        if (!client) {
            console.error("Supabase client not found.");
            alert("Supabase connection is not available.");
            return;
        }

        const currentUser = await window.authAPI?.getCurrentUser();

        if (!currentUser?.id) {
            console.error("Current user not found");
            alert("Please log in to create a post.");
            return;
        }

        const { error: insertError } = await client
            .from("posts")
            .insert({
                user_id: currentUser.id,
                caption: caption,
                image_url: null
            });

        if (insertError) {
            console.error("Create post error:", insertError);
            alert(insertError.message);
            return;
        }

        contentInput.value = "";
        await loadPosts();
    });
}

window.loadPosts = loadPosts;