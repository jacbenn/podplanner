import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};

envContent.split("\n").forEach((line) => {
  const [key, value] = line.split("=");
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const userUpdates = [
  { email: "user1@test.com", name: "Jacey" },
  { email: "user2@test.com", name: "Jackie" },
  { email: "user3@test.com", name: "Stacey" },
];

async function updateUsers() {
  console.log("Updating user names in Supabase...\n");

  for (const update of userUpdates) {
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === update.email);

    if (!user) {
      console.log(`✗ User ${update.email} not found`);
      continue;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { name: update.name },
    });

    if (error) {
      console.error(`✗ Failed to update ${update.email}: ${error.message}`);
    } else {
      console.log(`✓ Updated ${update.email} → name: "${update.name}"`);
    }
  }

  console.log("\nDone!");
}

updateUsers().catch(console.error);
