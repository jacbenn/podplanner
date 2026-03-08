import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};

envContent.split("\n").forEach((line) => {
  const [key, value] = line.split("=");
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env - this is required to update user metadata"
  );
  console.log("\nTo get the service role key:");
  console.log("1. Go to https://app.supabase.com");
  console.log("2. Select your project");
  console.log("3. Go to Settings → API");
  console.log("4. Copy the 'service_role' key");
  console.log("5. Add it to your .env as SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const userUpdates = [
  { email: "user1@test.com", name: "jacey" },
  { email: "user2@test.com", name: "jackie" },
  { email: "user3@test.com", name: "stacey" },
];

async function updateUsers() {
  console.log("Updating user names in Supabase...\n");

  for (const update of userUpdates) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        console.error(`Error fetching users: ${error.message}`);
        continue;
      }

      const user = data.users.find((u) => u.email === update.email);

      if (!user) {
        console.log(`✗ User ${update.email} not found`);
        continue;
      }

      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            name: update.name,
          },
        });

      if (updateError) {
        console.error(
          `✗ Failed to update ${update.email}: ${updateError.message}`
        );
      } else {
        console.log(`✓ Updated ${update.email} → name: "${update.name}"`);
      }
    } catch (err) {
      console.error(`✗ Error processing ${update.email}:`, err.message);
    }
  }

  console.log("\nDone!");
}

updateUsers().catch(console.error);
