Feature: Signed-in workspace member sees their dashboard
  As a workspace member
  I want my workspace's dashboard to load after sign-in
  So that I can see recent activity at a glance

  # BDD authenticates by planting a session row directly in
  # Postgres rather than driving Google OAuth — the only real
  # sign-in surface this app exposes. The "Given" step seeds
  # user + workspace_member + session and sets the better-auth
  # session cookie on the browser context; the After hook cleans
  # the seeded rows.

  Scenario: Workspace admin lands on the dashboard
    Given I'm signed in as a "workspace_admin" of workspace "tembo"
    When I visit "/tembo/dashboard"
    Then I should see the dashboard for "tembo"
