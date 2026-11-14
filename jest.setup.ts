import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// Raise the global async-utils timeout so waitFor/findBy* tolerate event-loop
// starvation when all suites run in parallel. Without this, data-bearing tests
// flake at the default 1000ms under load even though the code is correct.
configure({ asyncUtilTimeout: 5000 })
