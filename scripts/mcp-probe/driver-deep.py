import subprocess, concurrent.futures as cf, json

checks = {
"typeform-loc": ("HEADLOC","https://mcp.typeform.com/mcp"),
"drata-loc": ("HEADLOC","https://mcp.drata.com/mcp"),
"expensify-loc": ("HEADLOC","https://mcp.expensify.com/mcp"),
"dovetail-wk": ("GET","https://mcp.dovetail.com/.well-known/oauth-protected-resource"),
"dovetail-get": ("GETH","https://mcp.dovetail.com/mcp"),
"freshworks-wk": ("GET","https://mcp.freshworks.com/.well-known/oauth-protected-resource"),
"docusign-wk": ("GET","https://mcp.docusign.com/.well-known/oauth-protected-resource"),
"intuit-wk": ("GET","https://mcp.intuit.com/.well-known/oauth-protected-resource"),
"personio-wk": ("GET","https://mcp.personio.com/.well-known/oauth-protected-resource"),
"smartsheet-wk": ("GET","https://mcp.smartsheet.com/.well-known/oauth-protected-resource"),
"lucid-wk": ("GET","https://mcp.lucid.app/.well-known/oauth-protected-resource"),
"plaid-wk": ("GET","https://api.dashboard.plaid.com/.well-known/oauth-protected-resource"),
"contentful-wk": ("GET","https://mcp.contentful.com/.well-known/oauth-protected-resource"),
"pipedrive-wk": ("GET","https://mcp.pipedrive.com/.well-known/oauth-protected-resource"),
"gorgias-wk": ("GET","https://mcp.gorgias.com/.well-known/oauth-protected-resource"),
"pandadoc-wk": ("GET","https://mcp.pandadoc.com/.well-known/oauth-protected-resource"),
"mercury-wk": ("GET","https://mcp.mercury.com/.well-known/oauth-protected-resource"),
"jotform-wk": ("GET","https://mcp.jotform.com/.well-known/oauth-protected-resource"),
"shortcut-wk": ("GET","https://mcp.shortcut.com/.well-known/oauth-protected-resource"),
"serpapi-wk": ("GET","https://mcp.serpapi.com/.well-known/oauth-protected-resource"),
"hunter-wk": ("GET","https://mcp.hunter.io/.well-known/oauth-protected-resource"),
"airbyte-wk": ("GET","https://mcp.airbyte.ai/.well-known/oauth-protected-resource"),
"heroku-wk": ("GET","https://mcp.heroku.com/.well-known/oauth-protected-resource"),
"invideo-mcp": ("INIT","https://mcp.invideo.io/mcp"),
"dialpad-alt": ("INIT","https://dialpad.com/mcp"),
"digitalocean-alt": ("INIT","https://mcp.digitalocean.com/"),
"moderntreasury-alt": ("INIT","https://app.moderntreasury.com/mcp"),
"helpscout-alt": ("INIT","https://mcp.helpscout.net/mcp"),
"zoho-alt": ("INIT","https://mcp.zohoapis.com/mcp"),
"teamwork-wk": ("GET","https://mcp.ai.teamwork.com/.well-known/oauth-protected-resource"),
"canny-wk": ("GET","https://mcp.canny.io/.well-known/oauth-protected-resource"),
"courier-wk": ("GET","https://mcp.courier.com/.well-known/oauth-protected-resource"),
"mux-wk": ("GET","https://mcp.mux.com/.well-known/oauth-protected-resource"),
"telnyx-wk": ("GET","https://api.telnyx.com/.well-known/oauth-protected-resource"),
"exa-wk": ("GET","https://mcp.exa.ai/.well-known/oauth-protected-resource"),
"chilipiper-wk": ("GET","https://fire.chilipiper.com/api/fire-edge/v1/org/mcp/.well-known/oauth-protected-resource"),
"smartsheet-init2": ("INIT","https://mcp.smartsheet.com/mcp"),
"workato-get": ("GETH","https://mcp.workato.com/"),
}
init = json.dumps({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}})

def run(name, mode, url):
    try:
        if mode=="HEADLOC":
            p=subprocess.run(["curl","-sk","-o","/dev/null","-D","-","--max-time","10","-X","POST","-H","Content-Type: application/json","--data",init,url],capture_output=True,text=True,timeout=15)
            loc=[l for l in p.stdout.splitlines() if l.lower().startswith(("location","http"))]
            return name," | ".join(loc)[:200]
        if mode=="GET":
            p=subprocess.run(["curl","-sk","--max-time","10",url],capture_output=True,text=True,timeout=15)
            return name,p.stdout[:250].replace("\n"," ")
        if mode=="GETH":
            p=subprocess.run(["curl","-sk","-o","/dev/null","-D","-","--max-time","10",url,"-H","Accept: text/event-stream"],capture_output=True,text=True,timeout=15)
            lines=p.stdout.splitlines()
            return name,(lines[0] if lines else "")+" "+" ".join(l for l in lines if "auth" in l.lower())[:150]
        if mode=="INIT":
            p=subprocess.run(["curl","-sk","-o","/dev/null","-D","-","--max-time","10","-X","POST","-H","Content-Type: application/json","-H","Accept: application/json, text/event-stream","--data",init,url],capture_output=True,text=True,timeout=15)
            lines=p.stdout.splitlines()
            st=lines[0] if lines else "NOCONN"
            www=next((l for l in lines if l.lower().startswith("www-authenticate")),"")
            return name,st+" || "+www[:150]
    except Exception as e:
        return name,"ERR "+str(e)[:50]
with cf.ThreadPoolExecutor(20) as ex:
    for n,r in ex.map(lambda kv: run(kv[0],*kv[1]), checks.items()):
        print(n,"\t",r)
