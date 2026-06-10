## 2024-06-10 - O(N) Array Operations Consolidation
**Learning:** Multiple consecutive array iterations (`map`, `Math.max(...)`, `reduce`) create unnecessary performance overhead and intermediate array allocations, especially on critical rendering paths or with large data sets.
**Action:** Consolidate array operations into a single fast `for` loop (or a single `reduce`) whenever traversing the same filtered dataset multiple times for different aggregates (e.g., sum, max).
