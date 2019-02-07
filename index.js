#!/usr/bin/env node

const inquirer = require("inquirer");
const gitconfig = require("gitconfig");
const request = require("request");
const childProcessExec = require("child_process").exec;
const util = require("util");
const exec = util.promisify(childProcessExec);

const hookTypeOptions = [
  {
    name: "pre-commit (terminate operation)",
    value: "pre-commit"
  },
  {
    name: "post-commit (warning only)",
    value: "post-commit"
  },
  {
    name: "pre-push  (terminate operation)",
    value: "pre-push"
  }
];

const versionOptions = [
  {
    name: "2 (current stable)",
    value: "2"
  },
  {
    name: "3 (experimental)",
    value: "3"
  }
];

const setupQuestions = [
  {
    type: "input",
    name: "email",
    message: "Jira login email:",
    // default: gitConfig ? gitConfig.email : null,
    validate: email => !!email.length && /\w+@\w+/.test(email)
  },
  {
    type: "password",
    name: "password",
    message: "Jira login password:",
    validate: password => !!password.length
  },
  {
    type: "password",
    name: "confirmPassword",
    message: "Confirm password:",
    validate: (confirmPassword, answers) =>
      !!confirmPassword.length && confirmPassword == answers.password
  },
  {
    type: "list",
    name: "type",
    message: "What type of git hook you want to use for worklog?",
    choices: hookTypeOptions,
    // default: gitConfig ? getIndex(hookTypeOptions, gitConfig.type) : null
  },
  {
    type: "input",
    name: "url",
    message: "Full Jira board url:",
    // default: gitConfig ? gitConfig.url : null,
    validate: url => /^https:\/\//.test(url)
  },
  {
    type: "list",
    name: "version",
    message: "Which Jira REST API version your team is using?",
    choices: versionOptions,
    // default: gitConfig ? getIndex(versionOptions, gitConfig.version) : null
  }
];

gitconfig
  .get({
    location: "local"
  })
  .then(data => {
    let worklogConfig = data.worklog;

    // if no config, start the setup process
    if (!worklogConfig) {
      runConfig().then(worklogConfig => {
        checkWorkLog(worklogConfig)
      });
    } else {
      checkWorkLog(worklogConfig)
    }
    
  });

function runConfig() {
  return inquirer
    .prompt(setupQuestions)
    .then(answers => updateConfigFile(answers));
}

function updateConfigFile(worklogConfig) {
  return gitconfig.set(
    {
      worklog: worklogConfig
    },
    {
      location: "local"
    }
  ).then(_ => worklogConfig);
}

function checkWorkLog(worklogConfig) {
  getJiraCode()
    .then(branch => sendRequest(branch, worklogConfig))
    .catch(e => console.log(e.message));
}

function sendRequest(branch, worklogConfig) {
  try {
    getIssue(
      branch,
      worklogConfig.url,
      worklogConfig.version,
      worklogConfig.email,
      worklogConfig.password
    );
  } catch (e) {
    console.error(e.message);
  }
}

/**
 * Get Jira issue code out of current branch name
 */
async function getJiraCode() {
  const branches = await exec("git branch");
  const parseBranch = branches.stdout
    .split("\n")
    .find(b => b.charAt(0) === "*")
    .trim()
    .substring(2);
  return "DN-3815";
  if (parseBranch && parseBranch.match(/^\w+-\d+/)) {
    return parseBranch.match(/^\w+-\d+/)[0];
  }

  throw new Error(
    "Branch name " + parseBranch + " does not match naming convention"
  );
}

/**
 * Returns object index in collection, by value
 *
 * @param {Array} collection Each object must have *value* property.
 * @param {any} value Value to search for.
 */
function getIndex(collection, value) {
  return collection.map(e => e.value).indexOf(value);
}

function getIssue(branch, url, version, email, password) {
  console.log("=".repeat(50));
  console.log(`Verifying worklog for task ${branch}`);
  console.log("=".repeat(50));

  var credentials = Buffer.from(email + ":" + password).toString("base64");

  var options = {
    method: "GET",
    url: `${url}/rest/api/${version}/issue/${branch}/worklog`,
    headers: {
      Authorization: "Basic " + credentials,
      Accept: "application/json"
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);

    const wl = JSON.parse(body);

    console.log(`Registered worklogs: ${wl.total}`);
    console.log("-".repeat(50));

    if (wl.total) {
      wl.worklogs.forEach(work => {
        console.log(`${work.author.displayName}\t${work.timeSpent}`);
      });

      console.log("-".repeat(50));
    } else {
      console.error("You must log time for this task!");
      console.log("^".repeat(50));
    }
  });
}
