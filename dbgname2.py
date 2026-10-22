import io,sys
sys.stdout.reconfigure(encoding="utf-8")
D=r"D:/GitHub/MyFood/myfood-app/miniprogram/pages/detail/"
# check wxml: how name/brand fields bind value - van-field value={{dishName}}. Possible bug: race between loadRecords (list API without name?) and fillDetail.
# Key suspect: getFoods list API returns items but maybe truncates name/brand? Or the onShow flow: gid===selectedId path calls syncSelected() BEFORE records loaded -> rec undefined -> getFoodById fetch - fine.
# BUT loadRecords setData replaces records with fresh list; if user tapped from history, onShow: gid != selectedId -> setData selectedId + reload=true -> loadRecords -> syncSelected -> fillDetail with rec from list. List API /api/foods may return name fine.
# Race suspect: onShow when flavors empty: fillDetail sets flavorLevels from this.data.flavors (empty). Not related.
# Real suspect: van-field 'value' binding updates only when dishName changes; if same value, no re-render... but symptom is name SOMETIMES empty though data exists.
# Check worker list endpoint: does it return name/brand? maybe list SELECT omits them when page_size limit... check worker SELECT for list vs byId
W=r"D:/GitHub/MyFood/myfood-worker/src/worker.js"
c=io.open(W,encoding="utf-8",newline="").read()
i=c.find("SELECT")
while i>=0:
    seg=c[i:i+400]
    if "FROM foods" in seg:
        print("SELECT:",repr(seg[:380]))
        print("=====")
    i=c.find("SELECT",i+4)
