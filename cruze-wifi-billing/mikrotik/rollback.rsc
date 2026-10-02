# Removes only the dedicated Cruze billing API account/group created by setup.rsc.
# REVIEW FIRST.
:if ([:len [/user find name="cruze-billing"]] > 0) do={/user remove [find name="cruze-billing"]}
:if ([:len [/user group find name="cruze-billing-policy"]] > 0) do={/user group remove [find name="cruze-billing-policy"]}
:put "Cruze billing dedicated API account/group removed."
