"""Check the local demo boundary and module MIME type without production access."""
import importlib.util
import json
from pathlib import Path
from threading import Thread
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import unittest

spec = importlib.util.spec_from_file_location('risb_server', Path(__file__).resolve().parents[1] / 'scripts/serve.py')
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)

class LocalServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = server_module.partial(server_module.LocalHandler, directory=str(server_module.ROOT))
        cls.server = server_module.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_demo_validation_and_bad_input(self):
        for payload, valid in [({'input': 'risb-local'}, True), ({'input': 'wrong'}, False), ([], False)]:
            request = Request(self.origin + '/.netlify/functions/get-secret-message', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
            with urlopen(request) as response:
                self.assertEqual(json.load(response), {'valid': valid})
        for payload in [b'{broken', b'x' * 1025]:
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(self.origin + '/.netlify/functions/get-secret-message', data=payload))
            self.assertEqual(error.exception.code, 400)
            error.exception.close()

    def test_module_mime(self):
        with urlopen(self.origin + '/portal.mjs') as response:
            self.assertEqual(response.headers.get_content_type(), 'text/javascript')

if __name__ == '__main__':
    unittest.main()
