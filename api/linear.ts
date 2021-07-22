import { VercelRequest, VercelResponse } from '@vercel/node';
import { LinearClient } from '@linear/sdk'

const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY
})
const graphQLClient = client.client

const CURRENT_STATES = ['next up', 'in review', 'есть вопросы', 'принято', 'in progress'];
const ACTIVE_STATES  = ['in review', 'in progress'];

const issuesForState = async (stateId: String) => {
    const issuesByState = await graphQLClient.rawRequest(`
        query workflowState($id: String!) {
            workflowState(id: $id) {
                id
                name
                issues(first: 100) {
                    nodes {
                        title
                        assignee {
                            name
                        }
                        identifier
                        updatedAt
                        estimate
                        url
                    }
                }
            }
        }`,
        { id: stateId }
    );
    return issuesByState.data;
}

export default async (request: VercelRequest, response: VercelResponse) => {
    const issues = [] as any;    

    const workflowStates = await client.workflowStates({ first: 100 });
    const currentStates = workflowStates.nodes.filter(wfState => CURRENT_STATES.includes(wfState.name.toLowerCase()))

    for (let state of currentStates) {
        const stateIssuesNodes = await issuesForState(state.id);
        const stateIssues = stateIssuesNodes.workflowState.issues.nodes //await fetchAllNodes(stateIssueNodes);
        const mapped = stateIssues.filter(issue => !!issue.assignee).map(issue => (
            { 
                title: issue.title, 
                id: issue.id,
                user: issue.assignee.name,
                updatedAt: issue.updatedAt,
                estimate: issue.estimate,
                identifier: issue.identifier,
                url: issue.url,
                state: ACTIVE_STATES.includes(state.name) ? "active" : "nextup"
            }
        )); 
        issues.push(...mapped)
    }
    const issueInfo = issues.reduce((acc, issue) => {
        if (!acc.hasOwnProperty(issue.user)) acc[issue.user] = [];
        acc[issue.user].push(issue)
        return acc;
    }, {});

    response.status(200).json(issueInfo)
}