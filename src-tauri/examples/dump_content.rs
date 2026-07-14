use rusqlite::Connection;
fn main() {
    let path = std::env::args().nth(1).unwrap();
    let conn = Connection::open(&path).expect("open");
    let mut stmt = conn.prepare("SELECT id, name, content FROM week_tasks WHERE content LIKE '%svn.fastfish%' ORDER BY id DESC LIMIT 3").unwrap();
    let rows = stmt.query_map([], |r| Ok((r.get::<_,i64>(0)?, r.get::<_,String>(1)?, r.get::<_,String>(2)?))).unwrap();
    for r in rows {
        let (id, name, content) = r.unwrap();
        println!("===== id={} name={:?} =====", id, name);
        println!("{}", content);
        println!();
    }
}
