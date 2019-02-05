#!/usr/bin/env node

const inquirer = require('inquirer');
const parsrGitConfig = require('parse-git-config');
const request = require('request');
const childProcessExec = require('child_process').exec;
const util = require('util');
const exec = util.promisify(childProcessExec);

let gitConfig = getGitConfig().worklog;

const hookTypeOptions = [
  {
    name: 'pre-commit (terminate operation)',
    value: 'pre-commit'
  },
  {
    name: 'post-commit (warning only)',
    value: 'post-commit'
  },
  {
    name: 'pre-push  (terminate operation)',
    value: 'pre-push'
  }
];

const versionOptions = [
  {
    name: '2 (current stable)',
    value: '2'
  },
  {
    name: '3 (experimental)',
    value: '3'
  }
];

const setupQuestions = [
  {
    type: 'input',
    name: 'email',
    message: 'Jira login email:',
    default: gitConfig ? gitConfig.email : null,
    validate: email => !!email.length && /\w+@\w+/.test(email)
  },
  {
    type: 'password',
    name: 'password',
    message: 'Jira login password:',
    validate: password => !!password.length
  },
  {
    type: 'password',
    name: 'confirmPassword',
    message: 'Confirm password:',
    validate: (confirmPassword, answers) =>
      !!confirmPassword.length && confirmPassword == answers.password
  },
  {
    type: 'list',
    name: 'type',
    message: 'What type of git hook you want to use for worklog?',
    choices: hookTypeOptions,
    default: gitConfig ? getIndex(hookTypeOptions, gitConfig.type) : null
  },
  {
    type: 'input',
    name: 'url',
    message: 'Full Jira board url:',
    default: gitConfig ? gitConfig.url : null,
    validate: url => /^https:\/\//.test(url)
  },
  {
    type: 'list',
    name: 'version',
    message: 'Which Jira REST API version your team is using?',
    choices: versionOptions,
    default: gitConfig ? getIndex(versionOptions, gitConfig.version) : null
  }
];

if (!gitConfig) {
  inquirer.prompt(setupQuestions).then(answers => {
    gitConfig = answers ? answers : {};

    exec(`git config worklog.email ${gitConfig.email}`);
    exec(`git config worklog.password ${gitConfig.password}`);
    exec(`git config worklog.type ${gitConfig.type}`);
    exec(`git config worklog.url ${gitConfig.url}`);
    exec(`git config worklog.version ${gitConfig.version}`);

    getJiraCode()
      .then(branch => sendRequest(branch))
      .catch(e => console.log(e.message));
  });
} else {
  getJiraCode()
    .then(branch => sendRequest(branch))
    .catch(e => console.log(e.message));
}

function sendRequest(branch) {
  try {
    getIssue(
      branch,
      gitConfig.url,
      gitConfig.version,
      gitConfig.email,
      gitConfig.password
    )
  } catch (e) {
    console.error(e.message)
  }
}

/**
 * Get Jira issue code out of current branch name
 */
async function getJiraCode() {
  const branches = await exec('git branch');
  const parseBranch = branches.stdout
    .split('\n')
    .find(b => b.charAt(0) === '*')
    .trim()
    .substring(2);
  return 'DN-3815';
  if (parseBranch && parseBranch.match(/^\w+-\d+/)) {
    return parseBranch.match(/^\w+-\d+/)[0];
  }

  throw new Error(
    'Branch name ' + parseBranch + ' does not match naming convention'
  );
}

/**
 * Get local .git/config and parse it as JSON
 */
function getGitConfig() {
  return parsrGitConfig.sync();
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

  console.log('='.repeat(50));
  console.log(`Verifying worklog for task ${branch}`);
  console.log('='.repeat(50));

  var credentials = Buffer.from(email + ':' + password).toString('base64');

  var options = {
    method: 'GET',
    url: `${url}/rest/api/${version}/issue/${branch}/worklog`,
    headers: {
      Authorization: 'Basic ' + credentials,
      Accept: 'application/json'
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);

    const wl = JSON.parse(body);

    console.log(`Registered worklogs: ${wl.total}`);
    console.log('-'.repeat(50));

    if (wl.total) {
      wl.worklogs.forEach(work => {
        console.log(`${work.author.displayName}\t${work.timeSpent}`);
      });

      console.log('-'.repeat(50));
    } else {
      console.error('You must log time for this task!');
      console.log('^'.repeat(50));
    }
  });
}
