# SlackVoteBot
A bot user for the Slack app to track user polls

### Bot Commands
 - `{Poll title here}?` : use the question mark to start a poll
 - `toggle vote limit`: let people vote on more than one poll option (only the poll starter can set this)
 - `toggle anarchy`: let people add their own vote options (only the poll starter can set this)
 - `add`: add a vote option to the poll without voting on it
 - `vote`: vote on a poll option (adds the option if it wasn't already there)
 - `remove`: remove a vote option from the poll
 - `results`: print out the results of the poll
 - `close`: finish out the poll, closing it from more interaction
