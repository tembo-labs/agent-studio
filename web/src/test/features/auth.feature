Feature: Authentication gates the workspace surfaces
  As an operator
  I want anonymous visitors to land on the sign-in screen
  So that there's no path into a workspace without a session

  # Pilot E2E — proves the Cucumber + Playwright + cucumber.cjs
  # wiring actually drives a browser. Two scenarios cover the two
  # routes the layout treats differently for unauth callers:
  #   * `/` renders the sign-in surface in-place (no redirect)
  #   * `/<workspace>/...` calls notFound() so existence isn't
  #     leaked via a redirect.

  Scenario: Anonymous visit to the root shows the sign-in screen
    When I visit "/" without a session
    Then I should see the sign-in screen

  Scenario: Anonymous visit to a workspace route is not found
    When I visit "/tembo/connections" without a session
    Then the response should be a not-found page
