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
  { oldEmail: "user1@test.com", newEmail: "jacey@podplanner.com" },
  { oldEmail: "user2@test.com", newEmail: "jackie@podplanner.com" },
  { oldEmail: "user3@test.com", newEmail: "stacey@podplanner.com" },
];

async function updateEmails() {
  console.log("Updating user emails in Supabase...\n");

  for (const update of userUpdates) {
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === update.oldEmail);

    if (!user) {
      console.log(`✗ User ${update.oldEmail} not found`);
      continue;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: update.newEmail,
    });

    if (error) {
      console.error(`✗ Failed to update: ${error.message}`);
    } else {
      console.log(`✓ Updated ${update.oldEmail} → ${update.newEmail}`);
    }
  }

  console.log("\nDone!");
}

updateEmails().catch(console.error);
