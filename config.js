#!/usr/bin/env node

const inquirer = require("inquirer");
const gitconfig = require("gitconfig");

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
    choices: hookTypeOptions
  },
  {
    type: "input",
    name: "url",
    message: "Full Jira board url:",
    validate: url => /^https:\/\//.test(url)
  },
  {
    type: "list",
    name: "version",
    message: "Which Jira REST API version your team is using?",
    choices: versionOptions
  }
];

gitconfig
  .get({
    location: "local"
  })
  .then(data => {
    let worklogConfig = data.worklog;

    const reconfigure = shouldReconfigure();

    /**
     * If no worklog configuration was found,
     * or if --reconfigure argument was passed,
     * start the setup process
     */
    if (!worklogConfig || reconfigure) {
      runConfig(worklogConfig).then(worklogConfig => {
        console.log('worklog hook was configured successfully')
      });
    } else {
      console.log('Configuration for worklog has already been created. If you want to change the config options, start `npm run reconfig`')
    }
  });

/**
 * Returns true when --reconfigure argument is passed to the script.
 */
function shouldReconfigure() {
  return !!process.argv[2] && process.argv[2] === "--reconfigure";
}

function runConfig(worklogConfig) {
  return inquirer
    .prompt(setDefaults(setupQuestions, worklogConfig))
    .then(answers => updateConfigFile(answers));
}

/**
 * Set default values for setup questions, if previous configuration exists
 *
 * @param {Array} setupQuestions 
 * @param {Object} worklogConfig 
 */
function setDefaults(setupQuestions, worklogConfig) {
  if (!worklogConfig) {
    return setupQuestions;
  }

  setupQuestions.map(
    setupQuestion => {
      if (setupQuestion.type === 'list') {
        setupQuestion.default = getIndex(setupQuestion.choices, worklogConfig[setupQuestion.name])
      } else {
        setupQuestion.default = worklogConfig[setupQuestion.name];
      }

      return setupQuestion;
    }
  );

  return setupQuestions;
}

function updateConfigFile(worklogConfig) {
  return gitconfig
    .set(
      {
        worklog: worklogConfig
      },
      {
        location: "local"
      }
    )
    .then(_ => worklogConfig);
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


