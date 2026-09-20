// Verify and Fix Post Image URLs Script
// Run in browser console to inspect and fix posts table

async function verifyAndFixPostImages() {
    if (!window.supabaseClient) {
        console.error("Supabase client not found.");
        return;
    }

    // Get all posts with user info
    const { data: posts, error: postsError } = await window.supabaseClient
        .from("posts")
        .select("id, user_id, caption, image_url, created_at")
        .order("created_at", { ascending: false });

    if (postsError) {
        console.error("Posts error:", postsError);
        return;
    }

    // Get users to map user_id to username
    const { data: users, error: usersError } = await window.supabaseClient
        .from("users")
        .select("id, username");

    if (usersError) {
        console.error("Users error:", usersError);
        return;
    }

    const userMap = {};
    users.forEach((user) => {
        userMap[user.id] = user.username;
    });

    console.log("=== CURRENT POSTS TABLE ===");
    posts.forEach((post) => {
        const username = userMap[post.user_id] || "Unknown";
        console.log(`ID: ${post.id} | User: ${username} | Caption: "${post.caption}" | Image: ${post.image_url}`);
    });

    // Define the correct image URLs for specific posts
    const fixes = [
        {
            username: "mahrukh",
            captionContains: null,
            imageUrl: "https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg",
            description: "Mahrukh post"
        },
        {
            username: "hassan",
            captionContains: null,
            imageUrl: "https://enjoyedp.com/wp-content/uploads/2025/09/cartoon-cute-girl-pic-stylish_1.jpg",
            description: "Hassan post"
        },
        {
            username: null,
            captionContains: "Building something amazing",
            imageUrl: null, // Will preserve original if exists, otherwise flag
            description: '"Building something amazing!" post'
        }
    ];

    console.log("\n=== CHECKING FOR FIXES NEEDED ===");
    
    const changes = [];
    
    for (const post of posts) {
        const username = userMap[post.user_id] || "Unknown";
        
        for (const fix of fixes) {
            const matchesUsername = fix.username && username.toLowerCase() === fix.username.toLowerCase();
            const matchesCaption = fix.captionContains && post.caption && post.caption.toLowerCase().includes(fix.captionContains.toLowerCase());
            
            if (matchesUsername || matchesCaption) {
                const oldUrl = post.image_url;
                
                // For "Building something amazing!" - if it already has an image_url, keep it
                // If it's null/empty/wrong, we need to find the original intended image
                let newUrl = fix.imageUrl;
                
                if (fix.description === '"Building something amazing!" post') {
                    // Check if current image_url is valid (not null, not a girl's image URL)
                    if (oldUrl && oldUrl.trim() !== "") {
                        // Check if it's one of the problematic girl images
                        const problematicUrls = [
                            "https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg",
                            "https://enjoyedp.com/wp-content/uploads/2025/09/cartoon-cute-girl-pic-stylish_1.jpg"
                        ];
                        
                        if (problematicUrls.includes(oldUrl)) {
                            console.log(`⚠️ "${fix.description}" has wrong image (girl image): ${oldUrl}`);
                            console.log(`   Need to find original intended image for this post.`);
                            newUrl = null; // Don't auto-fix, need manual review
                        } else {
                            console.log(`✓ "${fix.description}" already has image: ${oldUrl}`);
                            newUrl = oldUrl; // Keep existing
                        }
                    } else {
                        console.log(`⚠️ "${fix.description}" has NO image_url (null/empty)`);
                        console.log(`   Need to find original intended image for this post.`);
                        newUrl = null;
                    }
                }
                
                if (newUrl && oldUrl !== newUrl) {
                    console.log(`\n🔧 FIX NEEDED: ${fix.description}`);
                    console.log(`   Post ID: ${post.id}`);
                    console.log(`   User: ${username}`);
                    console.log(`   Caption: "${post.caption}"`);
                    console.log(`   Old image_url: ${oldUrl}`);
                    console.log(`   New image_url: ${newUrl}`);
                    
                    changes.push({
                        id: post.id,
                        username: username,
                        caption: post.caption,
                        oldUrl: oldUrl,
                        newUrl: newUrl,
                        description: fix.description
                    });
                } else if (oldUrl === newUrl) {
                    console.log(`✓ "${fix.description}" already correct: ${oldUrl}`);
                }
            }
        }
    }
    
    // Apply changes
    if (changes.length > 0) {
        console.log("\n=== APPLYING FIXES ===");
        for (const change of changes) {
            const { error: updateError } = await window.supabaseClient
                .from("posts")
                .update({ image_url: change.newUrl })
                .eq("id", change.id);
            
            if (updateError) {
                console.error(`❌ Failed to update ${change.description} (ID: ${change.id}):`, updateError);
            } else {
                console.log(`✅ Updated ${change.description} (ID: ${change.id})`);
                console.log(`   Old: ${change.oldUrl}`);
                console.log(`   New: ${change.newUrl}`);
            }
        }
    } else {
        console.log("\n✅ No fixes needed - all posts have correct images");
    }
    
    // Summary
    console.log("\n=== SUMMARY OF CHANGES ===");
    if (changes.length > 0) {
        changes.forEach(c => {
            console.log(`${c.description}:`);
            console.log(`  Post ID: ${c.id}`);
            console.log(`  User: ${c.username}`);
            console.log(`  Caption: "${c.caption}"`);
            console.log(`  Old: ${c.oldUrl}`);
            console.log(`  New: ${c.newUrl}`);
        });
    } else {
        console.log("No changes made.");
    }
    
    return changes;
}

// Auto-run
if (typeof window !== "undefined") {
    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            verifyAndFixPostImages();
        }
    }, 100);
}