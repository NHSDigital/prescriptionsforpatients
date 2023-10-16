import os
import argparse
import re
from atlassian import Jira, Confluence
from typing import Tuple
import traceback
import sys
from github import Github

JIRA_TOKEN = os.getenv("JIRA_TOKEN")
JIRA_URL = "https://nhsd-jira.digital.nhs.uk/"
CONFLUENCE_TOKEN = os.getenv("CONFLUENCE_TOKEN")
CONFLUENCE_URL = "https://nhsd-confluence.digital.nhs.uk/"
# PROD_RELEASE_NOTES_PAGE_ID = 693750029
# INT_RELEASE_NOTES_PAGE_ID = 693750027
# GITHUB_REPO_NAME = "prescriptionsforpatients"
# PRODUCT_NAME = "Prescritpions for Patients AWS layer"
# INT_TITLE = "Current prescriptions for patients AWS layer release notes - INT"
# PROD_TITLE = "Current prescriptions for patients AWS layer release notes - PROD"


def get_jira_details(jira, jira_ticket_number: str) -> Tuple[str, str, str, str, str]:
    try:
        jira_ticket = jira.get_issue(jira_ticket_number)
        jira_title = jira_ticket["fields"]["summary"]
        jira_description = jira_ticket["fields"]["description"]
        components = [component["name"] for component in jira_ticket["fields"]["components"]]
        match = match = re.search(r'(user story)(.*?)background', jira_description,
                                  re.IGNORECASE | re.MULTILINE | re.DOTALL)
        if match:
            user_story = match.group(2).replace("*", "").replace("h3.", "").strip()
        else:
            user_story = "can not find user story"
        impact_field = jira_ticket.get("fields", {}).get("customfield_26905", {})
        if impact_field:
            impact = impact_field.get("value", "")
        else:
            impact = ""
        business_service_impact = jira_ticket["fields"].get("customfield_13618")
        return jira_title, user_story, components, impact, business_service_impact
    except:  # noqa: E722
        print(jira_ticket_number)
        print(traceback.format_exception(*sys.exc_info()))
        return f"can not find jira ticket for {jira_ticket_number}", "", "", "", ""


def append_output(current_output, text_to_add):
    return f"{current_output}\n{text_to_add}"


def create_release_notes(jira, current_tag, target_tag, repo, target_env):
    output = "This page is auto generated. Any manual modifications will be lost"

    output = append_output(output, f"<h1 id='Currentreleasenotes{target_tag}-plannedreleasetotag{target_tag}'>{PRODUCT_NAME} planned release to {target_env} of tag {target_tag}</h1>")  # noqa: E501
    output = append_output(output, f"<h2 id='Currentreleasenotes{target_tag}-Changessincecurrentlyreleasedtag{current_tag}'>Changes since currently released tag {current_tag}</h2>")  # noqa: E501

    diff = repo.compare(base=current_tag, head=target_tag)
    tags = repo.get_tags()
    for commit in diff.commits:
        release_tags = [tag.name for tag in tags if tag.commit == commit]
        if len(release_tags) == 0:
            release_tag = "can not find release tag"
        else:
            release_tag = release_tags[0]
        first_commit_line = commit.commit.message.splitlines()[0]
        match = re.search(r'(AEA[- ]\d*)', first_commit_line, re.IGNORECASE)
        if match:
            ticket_number = match.group(1).replace(' ', '-').upper()
            jira_link = f"https://nhsd-jira.digital.nhs.uk/browse/{ticket_number}"
            jira_title, user_story, components, impact, business_service_impact = get_jira_details(jira, ticket_number)
        else:
            jira_link = "n/a"
            jira_title = "n/a"
            user_story = "n/a"
            components = "n/a"
            impact = "n/a"
            business_service_impact = "n/a"
        user_story = user_story.replace("\n", "\n<br/>")
        github_link = f"https://github.com/NHSDigital/{GITHUB_REPO_NAME}/releases/tag/{release_tag}"
        output = append_output(output, "<p>***")

        output = append_output(output, f"<br/>jira link               :  <a class='external-link' href='{jira_link}' rel='nofollow'>{jira_link}</a>")  # noqa: E501
        output = append_output(output, f"<br/>jira title              : {jira_title}")
        output = append_output(output, f"<br/>user story              : {user_story}")
        output = append_output(output, f"<br/>commit title            : {first_commit_line}")
        output = append_output(output, f"<br/>release tag             : {release_tag}")
        output = append_output(output, f"<br/>github release          : <a class='external-link' href='{github_link}' rel='nofollow'>{github_link}</a>")  # noqa: E501
        output = append_output(output, f"<br/>Area affected           : {components}")
        output = append_output(output, f"<br/>Impact                  : {impact}")
        output = append_output(output, f"<br/>Business/Service Impact : {business_service_impact}")
        output = append_output(output, "</p>")

    return output


if __name__ == "__main__":
    script = argparse.ArgumentParser(description="Identify release notes for commits between two tags")

    script.add_argument(
        "--target-tag",
        help="A specific tag to deploy",
        required=True
    )

    script.add_argument(
        "--current-tag",
        help="Current tag",
        required=True
    )
    script.add_argument(
        "--release-notes-page-id",
        help="Release notes page id",
        required=True
    )
    script.add_argument(
        "--release-notes-page-title",
        help="Release notes page title",
        required=True
    )
    script.add_argument(
        "--repo-name",
        help="Github repo name",
        required=True
    )
    script.add_argument(
        "--product-name",
        help="Product name",
        required=True
    )
    script.add_argument(
        "--target-env",
        help="Target environment",
        required=True
    )

    args = script.parse_args()

    current_tag = args.current_tag
    target_tag = args.target_tag
    target_confluence_page_id = args.release_notes_page_id
    confluence_page_title = args.release_notes_page_title
    GITHUB_REPO_NAME = args.repo_name
    PRODUCT_NAME = args.product_name
    target_env = args.target_env

    jira = Jira(JIRA_URL, token=JIRA_TOKEN)
    gh = Github()
    repo = gh.get_repo(f"NHSDigital/{GITHUB_REPO_NAME}")

    output = create_release_notes(jira, current_tag, target_tag, repo, target_env)
    print(output)
    confluence = Confluence(CONFLUENCE_URL, token=CONFLUENCE_TOKEN)
    confluence.update_page(page_id=target_confluence_page_id, body=output, title=confluence_page_title)
