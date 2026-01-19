const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gvlhjjonhwhifxomwpgu.supabase.co';
// The key in .env.local looks like: sb_publishable_L0hxobXYPMlOjxs5SIt7eg_pmTL8O5x
// We will try using it.
const supabaseKey = 'sb_publishable_L0hxobXYPMlOjxs5SIt7eg_pmTL8O5x';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking table asset_measurements...");
    const { data: d1, error: e1 } = await supabase.from('asset_measurements').select('id').limit(1);
    if (e1) {
        console.error("Error accessing table:", e1);
    } else {
        console.log("Table exists.");
    }

    console.log("Checking column items_snapshot...");
    const { data: d2, error: e2 } = await supabase.from('asset_measurements').select('items_snapshot').limit(1);
    if (e2) {
        console.error("Error accessing column items_snapshot:", e2);
    } else {
        console.log("Column items_snapshot exists.");
    }
}

check();
