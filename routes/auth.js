router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      console.error('USER WITHOUT PASSWORD:', user);
      return res.status(500).json({ error: 'Corrupt user record' });
    }

    let match = false;

    try {
      match = bcrypt.compareSync(password, user.password);
    } catch (err) {
      console.error('BCRYPT ERROR:', err);
      return res.status(500).json({ error: 'Password verification failed' });
    }

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = makeToken(user);

    let profile = null;
    if (user.role === 'rider') {
      profile = db.prepare('SELECT * FROM rider_profiles WHERE user_id=?').get(user.id);
    }

    return res.json({ token, user: safe(user), profile });

  } catch (err) {
    console.error('LOGIN CRASH:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
});
