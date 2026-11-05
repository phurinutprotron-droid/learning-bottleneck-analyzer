"""Verify local demo sign-in without printing session tokens or seeding results."""
import httpx

with httpx.Client(base_url='http://127.0.0.1:5173', timeout=10) as client:
    print('Frontend:', client.get('/').status_code)
    print('Backend:', client.get('/health').json())
    for role in ('student', 'teacher', 'researcher'):
        response = client.post('/api/auth/login', json={'handle': f'demo_{role}', 'password': 'LbaDemo!2026'})
        assert response.status_code == 200, (role, response.status_code)
        data = response.json()
        assert data['user']['role'] == role
        headers = {'Authorization': 'Bearer ' + data['access_token']}
        path = '/api/students/' + data['user']['student_id'] if role == 'student' else '/api/students' if role == 'teacher' else '/api/research/summary'
        assert client.get(path, headers=headers).status_code == 200
        assert client.post('/api/auth/logout', headers=headers).status_code == 204
        print(f'demo_{role}: sign-in, role access and logout passed')
