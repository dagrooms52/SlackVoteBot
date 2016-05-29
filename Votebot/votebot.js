/*
 ___      ___ ________  _________  _______   ________  ________  _________   
|\  \    /  /|\   __  \|\___   ___\\  ___ \ |\   __  \|\   __  \|\___   ___\ 
\ \  \  /  / | \  \|\  \|___ \  \_\ \   __/|\ \  \|\ /\ \  \|\  \|___ \  \_| 
 \ \  \/  / / \ \  \\\  \   \ \  \ \ \  \_|/_\ \   __  \ \  \\\  \   \ \  \  
  \ \    / /   \ \  \\\  \   \ \  \ \ \  \_|\ \ \  \|\  \ \  \\\  \   \ \  \ 
   \ \__/ /     \ \_______\   \ \__\ \ \_______\ \_______\ \_______\   \ \__\
    \|__|/       \|_______|    \|__|  \|_______|\|_______|\|_______|    \|__|
    
    Voting assistant bot for Slack
    Developer: Daniel Grooms
    Date: 4/16/2016                   
*/

// Howdy variables
var Botkit = require("botkit");
var controller = Botkit.slackbot();

// You will have to add the token to your slack if you want to test this locally
var bot = controller.spawn({
    token: ""
});

bot.startRTM(function(err, bot, payload){
    if(err){
        throw new Error("Could not connect to Slack. " + err);
    }
});

// PollManager maps a channel name to a poll
var PollManager = {};

// Poll object tracks separate polls
var Poll = function(title, starter) {
    this.PollName = title;
    this.Active = true;
    this.Votes = {};
    this.VoteStarter = starter;
    this.MobCanAddVotes = false;
    this.MultiVote = false;
}

Poll.prototype.Reset = function() {
    this.Active = false;
    this.PollName = "";
    this.Votes = {};
    this.VoteStarter = "";
}

Poll.prototype.Vote = function(optionName, voter, isVote) {
     // Check if option is not in the poll yet
    var success = true;
    var voterAlreadyVoted = false;
    
    // Find out if user has voted on anything yet
    for(var key in this.Votes)
    {
        for(var user in this.Votes[key])
        {
            if(user.name == voter.name)
            {
                voterAlreadyVoted = true;
            }
        }
    }
    
    // Add option to poll if it isn't there
    if(!(optionName in this.Votes)){
        if(this.MobCanAddVotes || voter == this.VoteStarter){
            this.Votes[optionName] = [];
        } else {
            success = false;
        }
    }
    
    // Recheck if the option is there, it could be added above
    if(isVote && success && optionName in this.Votes){
        if(!(this.Votes[optionName].indexOf(voter)>-1) && (!voterAlreadyVoted || this.MultiVote))
        {
            this.Votes[optionName].push(voter);
        } else {
            success = false;
        }    
    }
    
    return success;
}

Poll.prototype.Print = function(message) {
    var attachmentOutput = [];
    
    for(var key in this.Votes){
        // TODO: Include emoji in text property once emojis are made
        attachmentOutput.push(key + ": " + this.Votes[key].length.toString());
    }
    
    var outputText = attachmentOutput.join("\n");
    bot.reply(message, {
        text: "*" + this.PollName + "*" + "\n" + outputText
    })
}

///////////////////////////
// --- Bot listeners --- //
///////////////////////////

// Start a vote
// Must be a direct mention to votebot and end in a question mark
// Command: @votebot *?
controller.hears(['.*\\?'], 'direct_mention', function(bot, message){
    // Make sure there is not an active vote already
    if(!(message.channel in PollManager) && message["text"].slice(-1)=="?"){
        PollManager[message.channel] = new Poll(message.text, message.user);
        
        bot.reply(message, "Let's vote on it! " + message.text);
    } else {
        bot.reply(message, 
            "Let's get done with the current vote first.\n" + 
            "*" + PollManager[message.channel].PollName + "*");
    }
})

// Toggle mob ability to vote on multiple options
// Command: @votebot toggle vote limit
controller.hears(['toggle vote limit'], ['direct_mention'], function(bot, message){
    if(message.channel in PollManager){
        var refPoll = PollManager[message.channel];
        if(message.user == refPoll.VoteStarter){
            PollManager[message.channel].MultiVote = !refPoll.MultiVote;
            bot.reply(message, "You can now vote on multiple options!");
        }
    }
})

// Toggle mob ability to add/remove their own options
// Command: @votebot toggle anarchy
controller.hears(['toggle anarchy'], ['direct_mention'], function(bot, message){
    if(message.channel in PollManager){
        var refPoll = PollManager[message.channel]
        if(message.user == refPoll.VoteStarter){
            PollManager[message.channel] = !refPoll.MobCanAddVotes;
            bot.reply(message, "Everyone can add vote options now!")
        }
    }
})

// Add one option to the vote
// Command: @votebot add *
controller.hears(['add .*'], ['direct_mention', 'mention'], function(bot, message){
    var success = false;
    if(message.channel in PollManager){        
        success = PollManager[message.channel].Vote(message.text.slice(4), message.user, false);
        
        if(success)
            PollManager[message.channel].Print(message);
        else
            bot.reply(message, "Permission is required to add an option!");
    }
    else
        bot.reply(message, "There is no active vote!");
})

// Vote on an option (add the option if it isn't in the vote yet)
// Command: @votebot vote *
controller.hears(['vote .*'], ['direct_mention', 'mention'], function(bot, message){
    var success = false;
    if(message.channel in PollManager){
        success = PollManager[message.channel].Vote(message.text.slice(5), message.user, true);
        
        if(success)
            PollManager[message.channel].Print(message);
        else
            bot.reply(message, "You've already voted or need permission to add an option!")
    }
    else
        bot.reply(message, "There is no active vote!")
})

// Print the poll results
// Command: @votebot results | print
controller.hears(['results', 'print'], ['direct_mention'], function(bot, message){
    if(message.channel in PollManager){
        PollManager[message.channel].Print(message);
    } else {
        bot.reply(message, "I'm not running a poll right now!");
    }
})

// Delete an option from the option pool by option name
// Command: @votebot remove *
controller.hears(['remove .*'], ['direct_mention'], function(bot, message){
    if(message.channel in PollManager && 
      message.user == PollManager[message.channel].VoteStarter){
        // Get the intended poll option to be removed
        var words = message.text.split(" ");
        var toRemove = "";
        for(var i = 1; i < words.length - 1; i++){
            toRemove += words[i] + " ";
        }
        toRemove += words[words.length - 1];

        if(toRemove in PollManager[message.channel].Votes){
            delete PollManager[message.channel].Votes[toRemove];
            PollManager[message.channel].Print();
        }
        else
            bot.reply(message, "Unable to find option _" + toRemove + "_")
    }
})

// Close the poll from any further voting
// Required: bot is direct mentioned
// Command: @votebot stop || @votebot close
controller.hears(['close', 'stop'], ['direct_mention'], function(bot, message){
    if(message.channel in PollManager && 
      message.user == PollManager[message.channel].VoteStarter){
        bot.reply(message, "Alright, here are the final results!");
        PollManager[message.channel].Print(message);

        // Cleanup
        delete PollManager[message.channel];
    }
})

// Print the list of available commands
var commands = [
    "*?*: use the question mark to start a poll",
    "*toggle vote limit*: let people vote on more than one poll option",
    "*toggle anarchy*: let people add their own vote options",
    "*add*: add a vote option to the poll without voting on it",
    "*vote*: vote on a poll option (adds the option if it wasn't already there)",
    "*remove*: remove a vote option from the poll",
    "*results*: print out the results of the poll",
    "*close*: finish out the poll, closing it from more interaction"
];
controller.hears(['help', 'options', 'commands'], ['direct_mention'], function(bot, message){
    var helpPrintout = "Here are all the commands I can do:\n" + commands.join("\n");
    
    bot.reply(message, helpPrintout);
})