// Empirical: can we std::fs::copy a SQLite db file while an r2d2 pool holds it open, same process, on Windows?
#[test]
fn fs_copy_open_sqlite_file() {
    use r2d2::Pool;
    use r2d2_sqlite::SqliteConnectionManager;
    use rusqlite::params;
    let base = std::env::temp_dir().join(format!("jilu_copytest_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&base);
    let mgr = SqliteConnectionManager::file(&base);
    let pool = Pool::builder().max_size(2).build(&mgr).unwrap();
    {
        let c = pool.get().unwrap();
        c.execute("CREATE TABLE t(x INTEGER)", []).unwrap();
        c.execute("INSERT INTO t VALUES (42)", []).unwrap();
    }
    // pool still open; attempt copy
    let dst = std::env::temp_dir().join(format!("jilu_copytest_dst_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&dst);
    let res = std::fs::copy(&base, &dst);
    println!("copy result: {:?}", res);
    // open the copy and verify data
    let got = {
        let mgr2 = SqliteConnectionManager::file(&dst);
        let p2 = Pool::builder().max_size(1).build(&mgr2).unwrap();
        let c = p2.get().unwrap();
        c.query_row("SELECT x FROM t", [], |r| r.get::<_, i64>(0)).unwrap()
    };
    println!("copied row x = {}", got);
    assert_eq!(got, 42);
    // also try -wal / -shm not present (default journal)
    let _ = std::fs::remove_file(&base);
    let _ = std::fs::remove_file(&dst);
}
