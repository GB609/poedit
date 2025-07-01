# poedit
Path of Exile ItemScript Editor / Preview

* Try out the original version at http://bschug.github.io/poedit/poedit.html
* A partial (and likely outdated) preview of the current state of this fork can be found at https://gb609.github.io/poedit/poedit.html

# Note:
This fork currently is in the process of reworking the underlying concept. It's very likely that it does not yet work as expected. 
I'm mostly doing this because i want to use this tool to develope my own item filter, so **i can't really guarantee long-time maintenance of the code**. It depends on how long my current PoE-binging phase lasts.

The basic idea of the concept change is to have item properties and filters defined as (importable and exportable) configuration instead of hard-coding each filter as a dedicated class. With this change, most of the changes GGG makes to the item filter rules can be updated here without touching a single line of code. That reduces the overall maintenance effort needed on the long run. At best, it should be an update of the default configuration every so often once i'm done.

# Issues:
Locked until this fork has become somewhat stable. 

But i've opened the discussion section to provide a general communication channel. Please keep it civil there. I don't normally dabble in social aspects of platforms like this and i'll simply disable it again if it doesn't work out.

# Upstream:
I normally go by the philosophy "upstream before downstream patching" when possible, because downstream patching just generates much more effort the more downstream starts to deviate. And pooling efforts allows for more and better progress, compared to just doing the same thing over and over again in forks and alternatives.

That being said, i **am** certainly doing a lot of heavy rewrites here at the moment which would be very hard to separate into manageable pull requests. Maybe that will change when i have sorted out the current state some more.

Nevertheless. When i've reached a more stable state, i'll see if, to what extend and how i can feed back my changes to upstream. That's also up to [bschug](https://github.com/bschug) and the question of long-term maintenance (him, me, someone else or no one at all).
