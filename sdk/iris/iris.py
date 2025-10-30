from .api import agents, threads
from .agent import IrisAgent
from .thread import IrisThread
from .tools import AgentPressTools, MCPTools


class Iris:
    def __init__(self, api_key: str, api_url="https://iris.so/api"):
        self._agents_client = agents.create_agents_client(api_url, api_key)
        self._threads_client = threads.create_threads_client(api_url, api_key)

        self.Agent = IrisAgent(self._agents_client)
        self.Thread = IrisThread(self._threads_client)
