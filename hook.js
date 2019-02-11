#!/usr/bin/env node

const gitconfig = require("gitconfig");
const request = require("request");
const childProcessExec = require("child_process").exec;
const util = require("util");
const exec = util.promisify(childProcessExec);
const chalk = require('chalk');
const ttyTable = require('tty-table');

gitconfig
  .get({
    location: "local"
  })
  .then(data => {
    let worklogConfig = data.worklog;

    if (!worklogConfig) {
      console.log(chalk.red('Configuration for worklog was not found! To setup one: `npm run configure`'));
      return;
    } else {
      checkWorkLog(worklogConfig);
    }
  });

function checkWorkLog(worklogConfig) {
  getJiraCode()
    .then(branch => sendRequest(branch, worklogConfig))
    .catch(e => console.log(chalk.red(e.message)));
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
  return "DN-3512";
  if (parseBranch && parseBranch.match(/^\w+-\d+/)) {
    return parseBranch.match(/^\w+-\d+/)[0];
  }

  throw new Error(
    "Branch name " + parseBranch + " does not match naming convention"
  );
}

function getIssue(branch, url, version, email, password) {
  console.log(chalk.bold.inverse(`Verifying worklog for task ${branch}\n`));

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

    if(wl.total > 0){
      console.log(chalk.green.inverse(`Registered worklogs: ${wl.total}`));
    } else {
      console.log(chalk.red.inverse(`Registered worklogs: ${wl.total}`));
    }

    if (wl.total) {

      const rows = [];
      
      wl.worklogs.forEach(work => {
        rows.push({
          displayName: work.author.displayName,
          time: work.timeSpent
        });
      });

      printTable(rows)

    } else {
      console.error(chalk.red.inverse("You must log time for this task!\n"));
    }
  });
}

function printTable(rows) {
  const header = [{
    value: 'displayName',
    alias: 'Name',
    headerAlign: 'left',
    align: 'left'
  }, {
    value: 'time',
    alias: 'Time',
    headerAlign: 'right',
    align: 'right'
  }];

  var wt = new ttyTable(header, rows);
  console.log(wt.render());
}